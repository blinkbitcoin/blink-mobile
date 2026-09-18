import { useCardInvestmentProgress } from "@app/hooks/use-card-investment-progress"
import {
  CardInvestmentBulletinKind,
  CardInvestmentBulletinState,
  CardInvestmentProgress,
} from "@app/types/card-investment"

import { useInvestmentFunding } from "./use-investment-funding"

type ResolveCardInvestmentBulletinParams = {
  progress: CardInvestmentProgress | null
  hasEnoughBalance: boolean
  isSplitAcrossWallets: boolean
  isFundingLoading: boolean
  hasPendingDeposit: boolean
  dismiss: () => void
}

/**
 * Pure so the order of precedence can be read on its own: the payment settles it, then
 * the balance, then a deposit in flight. Money already held outranks money on its way,
 * whether it sits in one wallet or is spread over both, because it is what the investor
 * can act on now. Nothing is said while the balance is unknown, since a zero mid-load
 * would nag an investor who is covered.
 */
export const resolveCardInvestmentBulletin = ({
  progress,
  hasEnoughBalance,
  isSplitAcrossWallets,
  isFundingLoading,
  hasPendingDeposit,
  dismiss,
}: ResolveCardInvestmentBulletinParams): CardInvestmentBulletinState | null => {
  if (!progress) return null
  if (progress.paidAt) {
    return { kind: CardInvestmentBulletinKind.Shareholder, progress, dismiss }
  }
  if (isFundingLoading) return null
  if (hasEnoughBalance) {
    return { kind: CardInvestmentBulletinKind.Ready, progress, dismiss }
  }
  if (isSplitAcrossWallets) {
    return { kind: CardInvestmentBulletinKind.SplitFunds, progress, dismiss }
  }
  if (hasPendingDeposit) {
    return { kind: CardInvestmentBulletinKind.DepositPending, progress, dismiss }
  }
  return { kind: CardInvestmentBulletinKind.Insufficient, progress, dismiss }
}

type UseCardInvestmentBulletinParams = {
  /** Whether a deposit into the custodial account is still confirming. The home already
   *  knows, so it is handed in rather than fetched a second time. */
  hasPendingDeposit: boolean
}

/**
 * Which investment bulletin the home shows, or null when there is nothing to say. The
 * amount comes from the signed investment; the balance is measured against it the same
 * way the transfer step measures it, so the bulletin and that step never disagree.
 */
export const useCardInvestmentBulletin = ({
  hasPendingDeposit,
}: UseCardInvestmentBulletinParams): CardInvestmentBulletinState | null => {
  const { progress, clear } = useCardInvestmentProgress()
  /** Hooks cannot be skipped, so with nothing signed the balance is measured against
   *  zero and the answer discarded; the measurement is a memo over data the home
   *  already holds. */
  const { hasEnoughBalance, isSplitAcrossWallets, isLoading } = useInvestmentFunding(
    progress?.selectedAmountUsd ?? 0,
    progress?.settlementSats,
  )

  return resolveCardInvestmentBulletin({
    progress,
    hasEnoughBalance,
    isSplitAcrossWallets,
    isFundingLoading: isLoading,
    hasPendingDeposit,
    dismiss: clear,
  })
}
