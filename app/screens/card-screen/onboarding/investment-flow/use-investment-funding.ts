import * as React from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks"
import { useSendWallets } from "@app/screens/send-bitcoin-screen/hooks/use-send-wallets"
import { toUsdMoneyAmount, toWalletAmount } from "@app/types/amounts"

import { type InvestmentFunding, resolveInvestmentFunding } from "./investment-terms"

/** Wallet balances are integers in their currency's minor unit; the agreement is written
 *  in whole dollars. */
const CENTS_PER_USD = 100

/**
 * What the investor holds against what they signed for.
 *
 * The fullest wallet decides, because a payment draws on one; the two added together
 * only say whether consolidating would be enough. Measured over the wallets the send
 * flow would offer, read through the hook the send flow itself reads, so a wallet that
 * flow will not pay from, the dollar wallet while it is gated, never counts as covering
 * the investment; it answers for a custodial and a self-custodial investor alike. The
 * judged wallet is named by id too, so the payment can be opened on it rather than on
 * whichever the send flow would pick by default.
 *
 * While it is loading the balance reads as zero, which would say the investment is not
 * covered when it may well be. Callers wait rather than act on that: the flag is what
 * that is for.
 */
export const useInvestmentFunding = (
  totalUsd: number,
): InvestmentFunding & {
  /** The wallet the balance is read from, so the shortfall can be named after it. */
  balanceCurrency: WalletCurrency
  /** That wallet's id, for the send flow to pay from; none while no wallet is offered. */
  balanceWalletId: string | undefined
  isLoading: boolean
} => {
  const { convertMoneyAmount } = usePriceConversion()
  const { wallets, btcWallet, loading } = useSendWallets()

  /** The fullest wallet, which one it is, and the two together. With nothing held the
   *  bitcoin wallet is named, as the one a deposit lands in. */
  const { largestWalletUsd, largestWallet, combinedUsd } = React.useMemo(() => {
    const empty: {
      largestWalletUsd: number
      largestWallet: { id: string; walletCurrency: WalletCurrency } | undefined
      combinedUsd: number
    } = { largestWalletUsd: 0, largestWallet: btcWallet, combinedUsd: 0 }
    if (!convertMoneyAmount || !wallets) return empty

    return wallets.reduce((funding, wallet) => {
      const balance = toWalletAmount({
        amount: wallet.balance,
        currency: wallet.walletCurrency,
      })
      const balanceUsd =
        convertMoneyAmount(balance, WalletCurrency.Usd).amount / CENTS_PER_USD
      const isFullest = balanceUsd > funding.largestWalletUsd
      return {
        largestWalletUsd: isFullest ? balanceUsd : funding.largestWalletUsd,
        largestWallet: isFullest ? wallet : funding.largestWallet,
        combinedUsd: funding.combinedUsd + balanceUsd,
      }
    }, empty)
  }, [wallets, btcWallet, convertMoneyAmount])

  return {
    ...resolveInvestmentFunding({ largestWalletUsd, combinedUsd, totalUsd }),
    balanceCurrency: largestWallet?.walletCurrency ?? WalletCurrency.Btc,
    balanceWalletId: largestWallet?.id,
    isLoading: !convertMoneyAmount || loading,
  }
}

/**
 * What the investment comes to in satoshis at today's price, which is what an invoice is
 * written in. Zero until the price feed answers.
 *
 * Its own hook, apart from the balance check, so each reads as the one rule it is: what
 * the investor holds is one question, what the invoice is written for is another, and
 * only the step that writes the invoice asks both.
 *
 * TEMPORARY, and the one figure here that should not be the app's to work out: the
 * agreement fixes a rate at a stamped moment and names the bitcoin owed against it, so
 * the amount charged has to be that one. Converting again at today's price would charge
 * something the signer never agreed to. It stands in until the mint returns the terms it
 * computed.
 */
export const useInvestmentSats = (totalUsd: number): number => {
  const { convertMoneyAmount } = usePriceConversion()

  return React.useMemo(() => {
    if (!convertMoneyAmount) return 0

    return convertMoneyAmount(
      toUsdMoneyAmount(totalUsd * CENTS_PER_USD),
      WalletCurrency.Btc,
    ).amount
  }, [totalUsd, convertMoneyAmount])
}
