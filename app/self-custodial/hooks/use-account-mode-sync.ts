import { useEffect } from "react"

import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveActiveSelfCustodialId } from "@app/store/persistent-state/active-self-custodial-account"
import {
  getSelfCustodialServerAccountMode,
  withSelfCustodialModeFromServer,
  withSelfCustodialServerAccountMode,
} from "@app/store/persistent-state/self-custodial-server-account-mode"
import { reportError } from "@app/utils/error-logging"

import { lnurlServerUrlFor } from "../config"
import { recoverLnurlServerMode, setLnurlServerMode } from "../lnurl-server-mode"
import { useSelfCustodialWallet } from "../providers/wallet"

import { useSparkNetwork } from "./use-spark-network"

/**
 * Keeps an account's mode and the LNURL server's copy of it in agreement, which is what
 * activates or silences its Lightning Address.
 *
 * An account holding no mode is settled from the server before anything is pushed: the
 * same wallet may already be Anon on another device, and assuming Enhanced would push
 * that away. Only once a mode is known does a disagreement become a push.
 *
 * Both are driven off stored state rather than off the moment the user picks a mode: the
 * choice is made on screens with no connected SDK to sign with, and a push that fails
 * offline has to happen later anyway. What lands is recorded so the next launch stays
 * quiet, since each Enhanced push costs the server a paid country lookup.
 */
export const useAccountModeSync = (): void => {
  const { accountMode } = useSelfCustodialAccountMode()
  const { persistentState, updateState } = usePersistentStateContext()
  const { sdk, connectedAccountId } = useSelfCustodialWallet()
  const lnurlServerUrl = lnurlServerUrlFor(useSparkNetwork())

  const activeAccountId = resolveActiveSelfCustodialId(persistentState)
  const serverMode = activeAccountId
    ? getSelfCustodialServerAccountMode(persistentState, activeAccountId)
    : null
  /**
   * The SDK signs as whichever account it connected for, while the mode and the record are
   * read from persistent state. Those two disagree for a commit on every account switch,
   * since the provider's teardown runs after this hook's effects: acting then would sign as
   * the previous account, push its Lightning Address away, and file the confirmation under
   * the new one, which would then never be pushed at all. Neither effect is due until the
   * connection and the active account are the same account.
   */
  const isSdkOnActiveAccount =
    Boolean(activeAccountId) && connectedAccountId === activeAccountId

  const isPushDue =
    isSdkOnActiveAccount && Boolean(accountMode) && accountMode !== serverMode
  /** An account that has never held a mode, whatever the reason: created before the modes
   *  existed, or provisioned on another device. */
  const isResolveDue = isSdkOnActiveAccount && !accountMode

  useEffect(() => {
    if (!sdk || !isResolveDue || !activeAccountId) return
    recoverLnurlServerMode({ sdk, serverUrl: lnurlServerUrl })
      .then((recovered) => {
        updateState(
          (prev) =>
            prev && withSelfCustodialModeFromServer(prev, activeAccountId, recovered),
        )
      })
      .catch((err) => reportError("lnurl server mode resolve", err))
  }, [sdk, isResolveDue, activeAccountId, lnurlServerUrl, updateState])

  useEffect(() => {
    if (!sdk || !isPushDue || !activeAccountId || !accountMode) return
    setLnurlServerMode({ sdk, serverUrl: lnurlServerUrl, mode: accountMode })
      .then(() => {
        updateState(
          (prev) =>
            prev &&
            withSelfCustodialServerAccountMode(prev, activeAccountId, accountMode),
        )
      })
      .catch((err) => reportError("lnurl server mode sync", err))
  }, [sdk, isPushDue, activeAccountId, accountMode, lnurlServerUrl, updateState])
}
