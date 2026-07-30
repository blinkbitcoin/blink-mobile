import { useEffect } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
import { ActiveWalletStatus } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"

import { deactivateStableBalance } from "../bridge"
import { useSelfCustodialWallet } from "../providers/wallet"

/**
 * Anon Mode must not auto-convert incoming payments, and the SDK's stable-balance
 * setting is what drives those conversions, so it is dropped while the mode is on.
 * Dropping it is only free while the dollar balance is known and empty; a remaining
 * balance is left alone, because deactivating would itself convert it unasked.
 */
export const useAnonStableBalanceDeactivation = (): void => {
  const { isAnonMode } = useSelfCustodialAccountMode()
  const { sdk, isStableBalanceActive, status, wallets, refreshStableBalanceActive } =
    useSelfCustodialWallet()

  const usdBalance =
    wallets.find((wallet) => wallet.walletCurrency === WalletCurrency.Usd)?.balance
      .amount ?? 0
  const isBalanceSettled =
    status === ActiveWalletStatus.Ready || status === ActiveWalletStatus.Degraded
  const isDeactivationDue =
    isAnonMode && Boolean(isStableBalanceActive) && isBalanceSettled && usdBalance === 0

  useEffect(() => {
    if (!sdk || !isDeactivationDue) return
    deactivateStableBalance(sdk)
      .then(() => refreshStableBalanceActive())
      .catch((err) => reportError("anon stable balance deactivation", err))
  }, [sdk, isDeactivationDue, refreshStableBalanceActive])
}
