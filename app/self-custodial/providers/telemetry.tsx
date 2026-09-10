import React, { useEffect } from "react"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import {
  ActiveAccountKind,
  createOutboxStore,
  deriveTelemetryMode,
  drainActiveOutbox,
  onTelemetrySuppressed,
  resolveTelemetryMode,
  setActiveOutbox,
} from "@app/telemetry"
import { AccountMode } from "@app/types/account"
import { AccountType } from "@app/types/wallet"

import { telemetryOutboxDirFor } from "../config"
import { useSelfCustodialAccountMode } from "../hooks/use-self-custodial-account-mode"
import { useSparkNetwork } from "../hooks/use-spark-network"

/**
 * Owns the outbox and the drain (AD-14), and resolves the mode that gates both.
 *
 * It lives here rather than in `useSdkLifecycle` because that hook is already 370 lines
 * carrying three refresh triggers and a reconnect loop, and privacy-critical logic landing
 * inside it is how the ordering rules below get lost in a later refactor. It holds no
 * context: nothing consumes one, and the boundary is reached through its module surface.
 *
 * The ordering here is load-bearing, and it is the FR-5 rule in code:
 *
 *  1. the store for the newly active account is mounted **first**, and its discard is
 *     registered with the gate;
 *  2. only then is the mode resolved, so an account that switched to incognito while it was
 *     inactive has its queue discarded on activation — before anything can drain it. That
 *     path is flush-then-discard by the back door, and it is the one AD-5 exists to close.
 */
export const SelfCustodialTelemetryMount: React.FC = () => {
  const { activeAccount, selfCustodialEntries } = useAccountRegistry()
  const { accountMode } = useSelfCustodialAccountMode()
  const { remoteConfigTrusted } = useFeatureFlags()
  const network = useSparkNetwork()

  const accountType = activeAccount?.type
  const accountId =
    accountType === AccountType.SelfCustodial ? activeAccount?.id ?? null : null
  const hasSelfCustodialAccount = selfCustodialEntries.length > 0

  useEffect(() => {
    if (!accountId) {
      setActiveOutbox(null)
      return
    }

    const store = createOutboxStore(telemetryOutboxDirFor(accountId, network))
    setActiveOutbox(store)

    /** Idempotent, and re-run on every activation: neither `unlink` nor a per-file delete
     *  is atomic, so a discard interrupted last session is finished now (AD-6). */
    const unsubscribe = onTelemetrySuppressed(() => store.discardAll())

    return () => {
      unsubscribe()
      setActiveOutbox(null)
    }
  }, [accountId, network])

  useEffect(() => {
    resolveTelemetryMode(
      deriveTelemetryMode({
        activeAccount: toActiveAccountKind(accountType),
        selfCustodialMode: toSelfCustodialMode(accountMode),
        remoteConfigTrusted,
        hasSelfCustodialAccount,
      }),
    )
  }, [accountType, accountMode, remoteConfigTrusted, hasSelfCustodialAccount])

  useEffect(() => {
    if (!accountId) return

    drainActiveOutbox()
    const timer = setInterval(() => {
      drainActiveOutbox()
    }, DRAIN_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [accountId, accountMode])

  return null
}

/** Long enough that the drain is not a proxy for what the user is doing, short enough to
 *  meet SM-6's ≤24h freshness with room to spare. The submission order and spacing inside a
 *  drain are randomised by the drain itself (AD-22). */
const DRAIN_INTERVAL_MS = 5 * 60 * 1000

const toActiveAccountKind = (type: AccountType | undefined): ActiveAccountKind => {
  if (type === AccountType.SelfCustodial) return ActiveAccountKind.SelfCustodial
  if (type === AccountType.Custodial) return ActiveAccountKind.Custodial
  return ActiveAccountKind.None
}

const toSelfCustodialMode = (mode: AccountMode | null): "enhanced" | "anon" | null => {
  if (mode === AccountMode.Enhanced) return "enhanced"
  if (mode === AccountMode.Anon) return "anon"
  return null
}
