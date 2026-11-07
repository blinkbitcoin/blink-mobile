import * as React from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks"
import { useSendWallets } from "@app/screens/send-bitcoin-screen/hooks/use-send-wallets"
import { toBtcMoneyAmount, toUsdMoneyAmount, toWalletAmount } from "@app/types/amounts"
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
 * Measured over the wallets the send flow would offer, read through the hook the send
 * flow itself reads, so a wallet that flow will not pay from, the dollar wallet while
 * it is gated, never counts as covering the investment; it answers for a custodial and
 * a self-custodial investor alike. The judged wallet is named by id too, so the payment
 * can be opened on it rather than on whichever the send flow would pick by default.
 * Balances arrive in cents and the agreement is written in whole dollars, so they are
 * converted at the edge and the rule reasons in dollars.
 *
 * While it is loading the balance reads as zero, which would say the investment is not
 * covered when it may well be. Callers wait rather than act on that: the flag is what
 * that is for.
 */
export const useInvestmentFunding = (
  totalUsd: number,
  settlementSats?: number,
): InvestmentFunding & {
  /** The debt in today's dollars, for whoever measures something else against it. */
  owedUsd: number
  /** The wallet the balance is read from, so the shortfall can be named after it. */
  balanceCurrency: WalletCurrency
  /** That wallet's id, for the send flow to pay from; none while no wallet is offered. */
  balanceWalletId: string | undefined
  isLoading: boolean
} => {
  const { convertMoneyAmount } = usePriceConversion()
  const { wallets, btcWallet, loading } = useSendWallets()

  /** The debt in today's dollars: the signed satoshis at today's rate, or the chosen
   *  dollars while nothing is signed. */
  const owedUsd = React.useMemo(() => {
    if (settlementSats === undefined || !convertMoneyAmount) return totalUsd

    return toMajorUnit(
      convertMoneyAmount(toBtcMoneyAmount(settlementSats), WalletCurrency.Usd).amount,
    )
  }, [settlementSats, totalUsd, convertMoneyAmount])

  /**
   * Each wallet in dollars, and whether it covers the debt on its own. A bitcoin wallet
   * against a signed debt is compared in satoshis, which is exact and needs no price:
   * the invoice is written in satoshis and paid within Blink, so no routing fee comes
   * off the top. A dollar wallet is compared in dollars at today's rate, since that is
   * what it buys. The wallet the payment would draw on is the fullest of those that
   * cover it, or the fullest of all when none does, the first listed winning a tie; with
   * nothing held the bitcoin wallet is named, as the one a deposit lands in.
   */
  const { balanceWallet, balanceUsd, isBalanceCovering, combinedUsd } =
    React.useMemo(() => {
      const empty = {
        balanceWallet: btcWallet,
        balanceUsd: 0,
        isBalanceCovering: false,
        combinedUsd: 0,
      }
      if (!convertMoneyAmount || !wallets) return empty

      const measured = wallets.map((wallet) => {
        const balance = toWalletAmount({
          amount: wallet.balance,
          currency: wallet.walletCurrency,
        })
        const usd = toMajorUnit(convertMoneyAmount(balance, WalletCurrency.Usd).amount)
        const isSignedBitcoinDebt =
          wallet.walletCurrency === WalletCurrency.Btc && settlementSats !== undefined
        const covers = isSignedBitcoinDebt
          ? wallet.balance >= settlementSats
          : usd >= owedUsd
        return { wallet, usd, covers }
      })
      type Measured = (typeof measured)[number]
      const fullestOf = (candidates: Measured[]): Measured | undefined =>
        candidates.reduce<Measured | undefined>(
          (best, candidate) => (best && best.usd >= candidate.usd ? best : candidate),
          undefined,
        )
      const chosen =
        fullestOf(measured.filter(({ covers }) => covers)) ?? fullestOf(measured)
      if (!chosen || (chosen.usd === 0 && !chosen.covers)) {
        return { ...empty, combinedUsd: measured.reduce((sum, { usd }) => sum + usd, 0) }
      }

      return {
        balanceWallet: chosen.wallet,
        balanceUsd: chosen.usd,
        isBalanceCovering: chosen.covers,
        combinedUsd: measured.reduce((sum, { usd }) => sum + usd, 0),
      }
    }, [wallets, btcWallet, convertMoneyAmount, settlementSats, owedUsd])

  return {
    ...resolveInvestmentFunding({
      balanceUsd,
      isBalanceCovering,
      combinedUsd,
      totalUsd: owedUsd,
    }),
    owedUsd,
    balanceCurrency: balanceWallet?.walletCurrency ?? WalletCurrency.Btc,
    balanceWalletId: balanceWallet?.id,
    isLoading: !convertMoneyAmount || loading,
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

    return convertMoneyAmount(toUsdMoneyAmount(toMinorUnit(totalUsd)), WalletCurrency.Btc)
      .amount
  }, [totalUsd, convertMoneyAmount])
}
