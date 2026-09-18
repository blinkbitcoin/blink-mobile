import * as React from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { toMajorUnit, toMinorUnit } from "@app/utils/helper"

import { type InvestmentFunding, resolveInvestmentFunding } from "./investment-terms"

/**
 * What the investor holds against what they owe.
 *
 * The fullest wallet decides, because a payment draws on one; the two added together
 * only say whether consolidating would be enough.
 *
 * Before the agreement is signed that is the dollar amount they chose. Once signed it is
 * the satoshis the agreement names, fixed at the rate of that moment, and the dollars no
 * longer describe the debt: bitcoin down, a wallet holding exactly those satoshis is
 * worth less than the chosen dollars yet pays the invoice in full; bitcoin up, a wallet
 * holding exactly the chosen dollars no longer buys those satoshis and the payment
 * fails. So with the satoshis known the debt is priced at today's rate and measured in
 * dollars like the balances, which is the same comparison in the wallet's own currency.
 *
 * Read through the active account, so it answers for a custodial and a self-custodial
 * investor alike. Balances arrive in cents and the agreement is written in whole
 * dollars, so they are converted at the edge and the rule reasons in dollars.
 *
 * While it is loading the balance reads as zero, which would say the investment is not
 * covered when it may well be. Callers wait rather than act on that: the flag is what
 * that is for.
 */
export const useInvestmentFunding = (
  totalUsd: number,
  settlementSats?: number,
): InvestmentFunding & {
  /** The wallet the balance is read from, so the shortfall can be named after it. */
  balanceCurrency: WalletCurrency
  isLoading: boolean
} => {
  const { convertMoneyAmount } = usePriceConversion()
  const { wallets, isReady } = useActiveWallet()

  /** The debt in today's dollars: the signed satoshis at today's rate, or the chosen
   *  dollars while nothing is signed. */
  const owedUsd = React.useMemo(() => {
    if (settlementSats === undefined || !convertMoneyAmount) return totalUsd

    return toMajorUnit(
      convertMoneyAmount(toBtcMoneyAmount(settlementSats), WalletCurrency.Usd).amount,
    )
  }, [settlementSats, totalUsd, convertMoneyAmount])

  /** The fullest wallet, which one it is, and the two together. With nothing held the
   *  bitcoin wallet is named, as the one a deposit lands in. */
  const { largestWalletUsd, largestWalletCurrency, combinedUsd } = React.useMemo(() => {
    const empty: {
      largestWalletUsd: number
      largestWalletCurrency: WalletCurrency
      combinedUsd: number
    } = { largestWalletUsd: 0, largestWalletCurrency: WalletCurrency.Btc, combinedUsd: 0 }
    if (!convertMoneyAmount) return empty

    return wallets.reduce((funding, wallet) => {
      const balanceUsd = toMajorUnit(
        convertMoneyAmount(wallet.balance, WalletCurrency.Usd).amount,
      )
      const isFullest = balanceUsd > funding.largestWalletUsd
      return {
        largestWalletUsd: isFullest ? balanceUsd : funding.largestWalletUsd,
        largestWalletCurrency: isFullest
          ? wallet.walletCurrency
          : funding.largestWalletCurrency,
        combinedUsd: funding.combinedUsd + balanceUsd,
      }
    }, empty)
  }, [wallets, convertMoneyAmount])

  return {
    ...resolveInvestmentFunding({ largestWalletUsd, combinedUsd, totalUsd: owedUsd }),
    balanceCurrency: largestWalletCurrency,
    isLoading: !convertMoneyAmount || !isReady,
  }
}

/**
 * What the investment comes to in satoshis at today's price. Zero until the price feed
 * answers.
 *
 * A fallback, not the figure to bill: the agreement fixes a rate at a stamped moment and
 * names the bitcoin owed against it, and the signing step carries that figure forward.
 * This stands in only when none was carried, since converting again at today's price
 * charges something the signer never agreed to.
 *
 * Its own hook, apart from the balance check, so each reads as the one rule it is: what
 * the investor holds is one question, what the invoice is written for is another, and
 * only the step that writes the invoice asks both.
 */
export const useInvestmentSats = (totalUsd: number): number => {
  const { convertMoneyAmount } = usePriceConversion()

  return React.useMemo(() => {
    if (!convertMoneyAmount) return 0

    return convertMoneyAmount(
      toUsdMoneyAmount(toMinorUnit(String(totalUsd))),
      WalletCurrency.Btc,
    ).amount
  }, [totalUsd, convertMoneyAmount])
}
