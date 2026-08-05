import { useEffect } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { useSelfCustodialAccountMode } from "@app/hooks/use-self-custodial-account-mode"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveActiveSelfCustodialId } from "@app/store/persistent-state/active-self-custodial-account"
import {
  isStableBalanceAnonPaused,
  withStableBalanceAnonPaused,
} from "@app/store/persistent-state/stable-balance-anon-pause"
import { ActiveWalletStatus } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"

import { activateStableBalance, deactivateStableBalance } from "../bridge"
import { SparkToken } from "../config"
import { useSelfCustodialWallet } from "../providers/wallet"

/**
 * Anon Mode must not auto-convert incoming payments, and the SDK's stable-balance
 * setting is what drives those conversions, so it is dropped while the mode is on.
 * Dropping it is only free while the dollar balance is known and empty; a remaining
 * balance is left alone, because deactivating would itself convert it unasked.
 *
 * The drop is recorded against the account so leaving Anon puts it back. The SDK is the
 * only record of that setting, so switching it off would otherwise erase an opt-in the
 * user never withdrew.
 */
export const useAnonStableBalanceDeactivation = (): void => {
  const { isAnonMode } = useSelfCustodialAccountMode()
  const { persistentState, updateState } = usePersistentStateContext()
  const { sdk, isStableBalanceActive, status, wallets, refreshStableBalanceActive } =
    useSelfCustodialWallet()

  const activeAccountId = resolveActiveSelfCustodialId(persistentState)
  const usdBalance =
    wallets.find((wallet) => wallet.walletCurrency === WalletCurrency.Usd)?.balance
      .amount ?? 0
  const isBalanceSettled =
    status === ActiveWalletStatus.Ready || status === ActiveWalletStatus.Degraded
  const isDeactivationDue =
    isAnonMode && Boolean(isStableBalanceActive) && isBalanceSettled && usdBalance === 0

  /** Only what Anon switched off comes back, and only once the mode is gone. A user who
   *  turned it off themselves left no marker, so nothing reactivates behind them. */
  const wasPausedByAnon = Boolean(
    activeAccountId && isStableBalanceAnonPaused(persistentState, activeAccountId),
  )
  const isReactivationDue =
    !isAnonMode && wasPausedByAnon && isBalanceSettled && isStableBalanceActive === false

  useEffect(() => {
    if (!sdk || !isDeactivationDue || !activeAccountId) return
    deactivateStableBalance(sdk)
      .then(() => {
        updateState(
          (prev) => prev && withStableBalanceAnonPaused(prev, activeAccountId, true),
        )
        return refreshStableBalanceActive()
      })
      .catch((err) => reportError("anon stable balance deactivation", err))
  }, [sdk, isDeactivationDue, activeAccountId, updateState, refreshStableBalanceActive])

  useEffect(() => {
    if (!sdk || !isReactivationDue || !activeAccountId) return
    activateStableBalance(sdk, SparkToken.Label)
      .then(() => {
        updateState(
          (prev) => prev && withStableBalanceAnonPaused(prev, activeAccountId, false),
        )
        return refreshStableBalanceActive()
      })
      .catch((err) => reportError("anon stable balance reactivation", err))
  }, [sdk, isReactivationDue, activeAccountId, updateState, refreshStableBalanceActive])
}
