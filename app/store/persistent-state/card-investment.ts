import { CardInvestmentProgress } from "@app/types/card-investment"

import { PersistentState } from "./state-migrations"

/** Nothing can be derived from a record without an amount the select screen could have
 *  produced, and a bulletin built on one would nag with nowhere to go. */
const hasPayableAmount = (progress: CardInvestmentProgress): boolean =>
  Number.isFinite(progress.selectedAmountUsd) && progress.selectedAmountUsd > 0

/**
 * The card investment one account signed for and has not closed out, or null.
 *
 * Keyed by the account's own id, handed in by the caller, rather than by the store's
 * active-account slot: every custodial profile on a device shares that slot, and a
 * signed investment, its invoice and its "paid" mark must never surface on another
 * person's home.
 */
export const getCardInvestment = (
  state: PersistentState,
  accountId: string,
): CardInvestmentProgress | null => {
  const progress = state.cardInvestmentByAccountId?.[accountId]
  return progress && hasPayableAmount(progress) ? progress : null
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
