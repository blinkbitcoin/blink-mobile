import * as React from "react"

import { TxDirection, WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks"
import { useCardInvestmentProgress } from "@app/hooks/use-card-investment-progress"
import { toWalletMoneyAmount } from "@app/types/amounts"
import {
  CardInvestmentBulletinKind,
  CardInvestmentBulletinState,
  CardInvestmentProgress,
} from "@app/types/card-investment"
import { toMajorUnit } from "@app/utils/helper"

import { useInvestmentFunding } from "./use-investment-funding"

type ResolveCardInvestmentBulletinParams = {
  progress: CardInvestmentProgress | null
  hasEnoughBalance: boolean
  isSplitAcrossWallets: boolean
  isFundingLoading: boolean
  /** What the wallet the payment would draw on holds, in dollars. */
  balanceUsd: number
  /** What is owed, in today's dollars. */
  owedUsd: number
  /** What is on its way into the account and not yet settled, in dollars. */
  pendingDepositUsd: number
  dismiss: () => void
}

/**
 * Pure so the order of precedence can be read on its own: the payment settles it, then
 * a payment on its way, then the balance, then a deposit in flight. Money already held
 * outranks money on its way, whether it sits in one wallet or is spread over both,
 * because it is what the investor can act on now; a deposit is only worth waiting on
 * when it would close the gap, since one that would not leaves the investor with a card
 * that says to wait and nothing to wait for. Nothing is said while the balance is
 * unknown, since a zero mid-load would nag an investor who is covered. Nothing is said
 * either once the welcome has been closed: the record stays, the card does not.
 */
export const resolveCardInvestmentBulletin = ({
  progress,
  hasEnoughBalance,
  isSplitAcrossWallets,
  isFundingLoading,
  balanceUsd,
  owedUsd,
  pendingDepositUsd,
  dismiss,
}: ResolveCardInvestmentBulletinParams): CardInvestmentBulletinState | null => {
  if (!progress) return null
  if (progress.paidAt) {
    if (progress.welcomeDismissedAt) return null
    return { kind: CardInvestmentBulletinKind.Shareholder, progress, dismiss }
  }
  if (progress.payingAt) {
    return { kind: CardInvestmentBulletinKind.PaymentPending, progress, dismiss }
  }
  if (isFundingLoading) return null
  if (hasEnoughBalance) {
    return { kind: CardInvestmentBulletinKind.Ready, progress, dismiss }
  }
  if (isSplitAcrossWallets) {
    return { kind: CardInvestmentBulletinKind.SplitFunds, progress, dismiss }
  }
  const isDepositClosingTheGap =
    pendingDepositUsd > 0 && balanceUsd + pendingDepositUsd >= owedUsd
  if (isDepositClosingTheGap) {
    return { kind: CardInvestmentBulletinKind.DepositPending, progress, dismiss }
  }
  return { kind: CardInvestmentBulletinKind.Insufficient, progress, dismiss }
}

/** A receive still confirming, as the home's own query lists it. */
export type PendingReceive = {
  direction: TxDirection
  settlementAmount: number
  settlementCurrency: WalletCurrency
}

type UseCardInvestmentBulletinParams = {
  /** The custodial account's transactions still confirming. The home already holds
   *  them, so they are handed in rather than fetched a second time; only the incoming
   *  ones count, priced here at today's rate. */
  pendingReceives: readonly PendingReceive[] | null | undefined
}

/**
 * Which investment bulletin the home shows, or null when there is nothing to say. The
 * amount comes from the signed investment; the balance is measured against it the same
 * way the transfer step measures it, so the bulletin and that step never disagree.
 */
export const useCardInvestmentBulletin = ({
  pendingReceives,
}: UseCardInvestmentBulletinParams): CardInvestmentBulletinState | null => {
  const { progress, dismissWelcome } = useCardInvestmentProgress()
  const { convertMoneyAmount } = usePriceConversion()
  /** Hooks cannot be skipped, so with nothing signed the balance is measured against
   *  zero and the answer discarded; the measurement is a memo over data the home
   *  already holds. */
  const { hasEnoughBalance, isSplitAcrossWallets, isLoading, balanceUsd, owedUsd } =
    useInvestmentFunding(progress?.selectedAmountUsd ?? 0, progress?.settlementSats)

  /** Each pending receive in dollars, summed after converting, so several small ones
   *  are not each floored to nothing. Zero until the price answers, which the loading
   *  flag already holds the card for. */
  const pendingDepositUsd = React.useMemo(() => {
    if (!convertMoneyAmount || !pendingReceives) return 0
    return pendingReceives
      .filter(
        ({ direction, settlementAmount }) =>
          direction === TxDirection.Receive && settlementAmount > 0,
      )
      .reduce(
        (sum, { settlementAmount, settlementCurrency }) =>
          sum +
          toMajorUnit(
            convertMoneyAmount(
              toWalletMoneyAmount(settlementAmount, settlementCurrency),
              WalletCurrency.Usd,
            ).amount,
          ),
        0,
      )
  }, [pendingReceives, convertMoneyAmount])

  return resolveCardInvestmentBulletin({
    progress,
    hasEnoughBalance,
    isSplitAcrossWallets,
    isFundingLoading: isLoading,
    balanceUsd,
    owedUsd,
    pendingDepositUsd,
    dismiss: dismissWelcome,
  })
}
