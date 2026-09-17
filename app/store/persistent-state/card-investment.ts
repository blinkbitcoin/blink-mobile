import { CardInvestmentProgress } from "@app/types/card-investment"

import { PersistentState } from "./state-migrations"

/**
 * How long a record is acted on, from its latest moment. The agreement and the link to
 * pay it are good for a day; past that the home would be pointing at a step whose
 * document has lapsed, so the record lapses with it and the flow starts over.
 */
export const CARD_INVESTMENT_LIFETIME_MS = 24 * 60 * 60 * 1000

/**
 * Nothing can be derived from a record without an amount the select screen could have
 * produced or a moment it was signed at; a bulletin built on one would nag with nowhere
 * to go. Checked to be an object first, because the record comes off disk.
 */
const isSound = (progress: CardInvestmentProgress): boolean =>
  typeof progress === "object" &&
  progress !== null &&
  Number.isFinite(progress.selectedAmountUsd) &&
  progress.selectedAmountUsd > 0 &&
  Number.isFinite(progress.signedAt)

/** The last thing that happened to the record, which its life is counted from. */
const latestMomentOf = (progress: CardInvestmentProgress): number =>
  progress.paidAt ?? progress.signedAt

const isCurrent = (progress: CardInvestmentProgress, now: number): boolean =>
  now - latestMomentOf(progress) < CARD_INVESTMENT_LIFETIME_MS

/**
 * The card investment one account signed for and has not closed out, or null when there
 * is none or the one there has lapsed.
 *
 * Keyed by the account's own id, handed in by the caller, rather than by the store's
 * active-account slot: every custodial profile on a device shares that slot, and a
 * signed investment, its invoice and its "paid" mark must never surface on another
 * person's home.
 */
export const getCardInvestment = (
  state: PersistentState,
  accountId: string,
  now: number,
): CardInvestmentProgress | null => {
  const progress = state.cardInvestmentByAccountId?.[accountId]
  return progress && isSound(progress) && isCurrent(progress, now) ? progress : null
}

export const withCardInvestment = (
  state: PersistentState,
  accountId: string,
  progress: CardInvestmentProgress,
): PersistentState => ({
  ...state,
  cardInvestmentByAccountId: {
    ...state.cardInvestmentByAccountId,
    [accountId]: progress,
  },
})

export const withoutCardInvestment = (
  state: PersistentState,
  accountId: string,
): PersistentState => {
  if (!state.cardInvestmentByAccountId?.[accountId]) return state

  const { [accountId]: _dropped, ...rest } = state.cardInvestmentByAccountId
  return { ...state, cardInvestmentByAccountId: rest }
}
