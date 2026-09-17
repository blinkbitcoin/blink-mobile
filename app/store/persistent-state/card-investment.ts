import { CardInvestmentRecord, isSignedCardInvestment } from "@app/types/card-investment"

import { PersistentState } from "./state-migrations"

/**
 * Nothing can be derived from a signed record without an amount the select screen could
 * have produced, or from an invitation without a moment it was opened at; a bulletin
 * built on either would nag with nowhere to go.
 */
const isSound = (record: CardInvestmentRecord): boolean => {
  if (isSignedCardInvestment(record)) {
    return Number.isFinite(record.selectedAmountUsd) && record.selectedAmountUsd > 0
  }
  return Number.isFinite(record?.invitedAt)
}

/**
 * The card investment one account opened or signed for and has not closed out, or null.
 *
 * Keyed by the account's own id, handed in by the caller, rather than by the store's
 * active-account slot: every custodial profile on a device shares that slot, and a
 * signed investment, its invoice and its "paid" mark must never surface on another
 * person's home.
 */
export const getCardInvestment = (
  state: PersistentState,
  accountId: string,
): CardInvestmentRecord | null => {
  const record = state.cardInvestmentByAccountId?.[accountId]
  return record && isSound(record) ? record : null
}

export const withCardInvestment = (
  state: PersistentState,
  accountId: string,
  record: CardInvestmentRecord,
): PersistentState => ({
  ...state,
  cardInvestmentByAccountId: {
    ...state.cardInvestmentByAccountId,
    [accountId]: record,
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
