import * as React from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { toUsdMoneyAmount } from "@app/types/amounts"

import { type InvestmentFunding, resolveInvestmentFunding } from "./investment-terms"

/** Wallet balances are integers in their currency's minor unit; the agreement is written
 *  in whole dollars. */
const CENTS_PER_USD = 100

/**
 * What the investor holds against what they signed for.
 *
 * Both wallets count, which is what the flow tells them: the money may sit in either, and
 * the transfer is one payment for the whole amount. Reads through the active account, so
 * it answers for a custodial and a self-custodial investor alike.
 *
 * While it is loading the balance reads as zero, which would say the investment is not
 * covered when it may well be. Callers wait rather than act on that: the flag is what
 * that is for.
 */
export const useInvestmentFunding = (
  totalUsd: number,
): InvestmentFunding & { totalSats: number; isLoading: boolean } => {
  const { convertMoneyAmount } = usePriceConversion()
  const { wallets, isReady } = useActiveWallet()

  const balanceUsd = React.useMemo(() => {
    if (!convertMoneyAmount) return 0

    const cents = wallets.reduce(
      (total, wallet) =>
        total + convertMoneyAmount(wallet.balance, WalletCurrency.Usd).amount,
      0,
    )

    return cents / CENTS_PER_USD
  }, [wallets, convertMoneyAmount])

  /**
   * What the investment comes to in satoshis, which is what an invoice is written in.
   *
   * TEMPORARY, and the one figure here that should not be the app's to work out: the
   * agreement fixes a rate at a stamped moment and names the bitcoin owed against it, so
   * the amount charged has to be that one. Converting again at today's price would charge
   * something the signer never agreed to. It stands in until the mint returns the terms
   * it computed.
   */
  const totalSats = React.useMemo(() => {
    if (!convertMoneyAmount) return 0

    return convertMoneyAmount(
      toUsdMoneyAmount(totalUsd * CENTS_PER_USD),
      WalletCurrency.Btc,
    ).amount
  }, [totalUsd, convertMoneyAmount])

  return {
    ...resolveInvestmentFunding({ balanceUsd, totalUsd }),
    totalSats,
    isLoading: !convertMoneyAmount || !isReady,
  }
}
