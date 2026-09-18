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
): InvestmentFunding & {
  /** The wallet the balance is read from, so the shortfall can be named after it. */
  balanceCurrency: WalletCurrency
  isLoading: boolean
} => {
  const { convertMoneyAmount } = usePriceConversion()
  const { wallets, isReady } = useActiveWallet()

  /** Each wallet on its own and the two together: a payment draws on one, so what the
   *  fullest holds decides whether it can go through, and the sum only says whether
   *  consolidating would be enough. With nothing held the bitcoin wallet is named, as
   *  the one a deposit lands in. */
  const { largestWalletUsd, largestWalletCurrency, combinedUsd } = React.useMemo(() => {
    const empty: {
      largestWalletUsd: number
      largestWalletCurrency: WalletCurrency
      combinedUsd: number
    } = { largestWalletUsd: 0, largestWalletCurrency: WalletCurrency.Btc, combinedUsd: 0 }
    if (!convertMoneyAmount) return empty

    return wallets.reduce((funding, wallet) => {
      const balanceUsd =
        convertMoneyAmount(wallet.balance, WalletCurrency.Usd).amount / CENTS_PER_USD
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
    ...resolveInvestmentFunding({ largestWalletUsd, combinedUsd, totalUsd }),
    balanceCurrency: largestWalletCurrency,
    isLoading: !convertMoneyAmount || !isReady,
  }
}

/**
 * What the investment comes to in satoshis at today's price, which is what an invoice is
 * written in. Zero until the price feed answers.
 *
 * Its own hook, apart from the balance check: only the step that writes the invoice needs
 * it, and the screens that merely measure the balance should not pay for a conversion
 * they discard.
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
