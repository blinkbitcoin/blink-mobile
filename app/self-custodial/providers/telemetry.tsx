import React, { useCallback, useEffect } from "react"
import { AppState } from "react-native"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { getSelfCustodialServerAccountMode } from "@app/store/persistent-state/self-custodial-server-account-mode"
import {
  ActiveAccountKind,
  createOutboxStore,
  deriveTelemetryMode,
  drainActiveOutbox,
  onTelemetrySuppressed,
  resolveTelemetryMode,
  restoreKillSwitch,
  setActiveOutbox,
  setEmissionListener,
  setTelemetryRolloutEnabled,
  TelemetryMode,
  type SelfCustodialModeAnswer,
} from "@app/telemetry"
import { onKillSwitchEngaged } from "@app/telemetry/enablement"
import { AccountMode } from "@app/types/account"
import { AccountType, ActiveWalletStatus } from "@app/types/wallet"

import { lnurlServerUrlFor, telemetryOutboxDirFor } from "../config"
import { useSelfCustodialAccountMode } from "../hooks/use-self-custodial-account-mode"
import { useSparkNetwork } from "../hooks/use-spark-network"
import { refreshTelemetryKillSwitch } from "../lnurl-telemetry-config"

import { useSelfCustodialWallet } from "./wallet"

/**
 * Owns the outbox and the drain (AD-14), resolves the mode that gates both (AD-25), and
 * holds the two switches in front of the gate (AD-28, AD-30).
 *
 * It lives here rather than in `useSdkLifecycle` because that hook is already 370 lines
 * carrying three refresh triggers and a reconnect loop, and privacy-critical logic landing
 * inside it is how the ordering rules below get lost in a later refactor. It holds no
 * context: nothing consumes one, and the boundary is reached through its module surface.
 *
 * The ordering here is load-bearing, and it is the FR-5 rule in code:
 *
 *  1. the store for the newly active account is mounted **first**, its discard is
 *     registered with the gate, and any discard the previous run left unfinished — the
 *     `.discard` marker, or a queue under a mode that may not hold one — is finished now
 *     (AD-26);
 *  2. only then is the mode resolved, so an account that switched to incognito while it was
 *     inactive has its queue discarded on activation — before anything can drain it. That
 *     path is flush-then-discard by the back door, and it is the one AD-5 exists to close.
 *
 * The drain's triggers are exactly AD-26's three — SDK connect, a successful emission, and
 * app foreground — and it never subscribes to the 10 s connectivity poll. Each trigger
 * asks first whether the SDK is connected for this account and the wallet is online; the
 * mode gate and the switches are the drain's own to check.
 *
 * Two more things ride the same lifecycle. The kill switch is refreshed from its
 * Blink-controlled channel on activation and foreground, from devices that may report
 * (AD-28) — which is what makes it reachable for an account that settled its mode long
 * ago and never calls `/recover` again. And every self-custodial account's outbox is swept
 * on mount, not only the active one's, so a queue left behind by an account that is never
 * activated again still expires on FR-25's schedule rather than sitting on disk.
 */
export const SelfCustodialTelemetryMount: React.FC = () => {
  const { activeAccount, selfCustodialEntries } = useAccountRegistry()
  const { accountMode } = useSelfCustodialAccountMode()
  const { persistentState, updateState } = usePersistentStateContext()
  const { remoteConfigTrusted, telemetryEnabled } = useFeatureFlags()
  const { connectedAccountId, status } = useSelfCustodialWallet()
  const network = useSparkNetwork()

  const accountType = activeAccount?.type
  const accountId =
    accountType === AccountType.SelfCustodial ? activeAccount?.id ?? null : null
  const hasSelfCustodialAccount = selfCustodialEntries.length > 0

  const serverMode = accountId
    ? getSelfCustodialServerAccountMode(persistentState, accountId)
    : null

  const mode = deriveTelemetryMode({
    activeAccount: toActiveAccountKind(accountType),
    persistedMode: toModeAnswer(accountMode),
    serverMode: toModeAnswer(serverMode),
    remoteConfigTrusted,
    hasSelfCustodialAccount,
  })

  /** AD-28 / AD-30: both switches sit in front of the gate, and both default to off. */
  const killSwitchEngaged = persistentState.telemetryKillSwitchEngaged === true
  useEffect(() => {
    restoreKillSwitch(killSwitchEngaged)
  }, [killSwitchEngaged])

  useEffect(() => {
    setTelemetryRolloutEnabled(telemetryEnabled)
  }, [telemetryEnabled])

  useEffect(
    () =>
      onKillSwitchEngaged(() => {
        updateState((prev) => prev && { ...prev, telemetryKillSwitchEngaged: true })
      }),
    [updateState],
  )

  /** FR-25: the TTL applies to every account's queue, active or not. `pending()` sweeps.
   *  The active account's own store sweeps on every drain, so it is left out here; the
   *  store serialises by directory anyway, so even an overlap could not race it. */
  const inactiveAccountIds = selfCustodialEntries
    .map((entry) => entry.id)
    .filter((id) => id !== accountId)
    .join(",")
  useEffect(() => {
    for (const id of inactiveAccountIds.split(",").filter(Boolean)) {
      createOutboxStore(telemetryOutboxDirFor(id, network))
        .pending()
        .catch(() => undefined)
    }
  }, [inactiveAccountIds, network])

  useEffect(() => {
    if (!accountId) {
      setActiveOutbox(null)
      return
    }

    const store = createOutboxStore(telemetryOutboxDirFor(accountId, network))
    setActiveOutbox(store)
    const unsubscribe = onTelemetrySuppressed(() => store.discardAll())

    /**
     * AD-26: finish what the last run started. Neither RNFS primitive is atomic, so a
     * discard that died halfway leaves records behind — and its marker. A queue under a
     * mode that may not hold one is discarded here too, whether or not a marker exists:
     * `resolveTelemetryMode` is a no-op when the mode has not changed, so a cold start
     * straight into `Unresolved` would otherwise never fire the suppression listener.
     */
    store
      .hasPendingDiscard()
      .then((pending) => {
        if (pending || isSuppressedMode(mode)) return store.discardAll()
        return undefined
      })
      .catch(() => undefined)

    return () => {
      unsubscribe()
      setActiveOutbox(null)
    }
    // The mode is read once, at mount, on purpose: a later change reaches the store
    // through the suppression listener registered above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, network])

  useEffect(() => {
    resolveTelemetryMode(mode)
  }, [mode])

  const sdkConnectedForAccount = Boolean(accountId) && connectedAccountId === accountId
  const walletOnline = status !== ActiveWalletStatus.Offline

  const drainIfAble = useCallback(() => {
    if (!sdkConnectedForAccount || !walletOnline) return
    drainActiveOutbox()
  }, [sdkConnectedForAccount, walletOnline])

  /** Trigger 1: SDK connect. */
  useEffect(() => {
    drainIfAble()
  }, [drainIfAble])

  /** Trigger 2: a successful emission. */
  useEffect(() => {
    setEmissionListener(drainIfAble)
    return () => setEmissionListener(null)
  }, [drainIfAble])

  const mayReport = mode === TelemetryMode.Custodial || mode === TelemetryMode.Enhanced
  const lnurlServerUrl = lnurlServerUrlFor(network)

  /** AD-28: the switch is fetched on activation, from a device that may report. Nothing
   *  is fetched from an Anon or Unresolved device — a request is a transmission too. */
  useEffect(() => {
    if (mayReport) refreshTelemetryKillSwitch(lnurlServerUrl)
  }, [mayReport, lnurlServerUrl])

  /** Trigger 3: app foreground — for the drain, and for the switch. */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return
      if (mayReport) refreshTelemetryKillSwitch(lnurlServerUrl)
      drainIfAble()
    })
    return () => subscription.remove()
  }, [drainIfAble, mayReport, lnurlServerUrl])

  return null
}

const isSuppressedMode = (mode: TelemetryMode): boolean =>
  mode === TelemetryMode.Anon || mode === TelemetryMode.Unresolved

const toActiveAccountKind = (type: AccountType | undefined): ActiveAccountKind => {
  if (type === AccountType.SelfCustodial) return ActiveAccountKind.SelfCustodial
  if (type === AccountType.Custodial) return ActiveAccountKind.Custodial
  return ActiveAccountKind.None
}

const toModeAnswer = (mode: AccountMode | null): SelfCustodialModeAnswer => {
  if (mode === AccountMode.Enhanced) return "enhanced"
  if (mode === AccountMode.Anon) return "anon"
  return null
}
