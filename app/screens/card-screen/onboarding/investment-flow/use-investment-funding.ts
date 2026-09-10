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

  /** Each wallet on its own and the two together: a payment draws on one, so what the
   *  fullest holds decides whether it can go through, and the sum only says whether
   *  consolidating would be enough. */
  const { largestWalletUsd, combinedUsd } = React.useMemo(() => {
    if (!convertMoneyAmount) return { largestWalletUsd: 0, combinedUsd: 0 }

    const balances = wallets.map(
      (wallet) =>
        convertMoneyAmount(wallet.balance, WalletCurrency.Usd).amount / CENTS_PER_USD,
    )

    return {
      largestWalletUsd: Math.max(0, ...balances),
      combinedUsd: balances.reduce((total, balance) => total + balance, 0),
    }
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
    ...resolveInvestmentFunding({ largestWalletUsd, combinedUsd, totalUsd }),
    totalSats,
    isLoading: !convertMoneyAmount || !isReady,
  }
}
