import { CardInvestmentRecord, isSignedCardInvestment } from "@app/types/card-investment"

import { PersistentState } from "./state-migrations"

/**
 * How long a record is acted on, from its latest moment. The agreement and the link to
 * pay it are good for a day; past that the home would be pointing at a step whose
 * document has lapsed, so the record lapses with it and the flow starts over.
 */
export const CARD_INVESTMENT_LIFETIME_MS = 24 * 60 * 60 * 1000

/**
 * Nothing can be derived from a signed record without an amount the select screen could
 * have produced or a moment it was signed at, or from an invitation without a moment it
 * was opened at; a bulletin built on either would nag with nowhere to go.
 */
const isSound = (record: CardInvestmentRecord): boolean => {
  if (isSignedCardInvestment(record)) {
    return (
      Number.isFinite(record.selectedAmountUsd) &&
      record.selectedAmountUsd > 0 &&
      Number.isFinite(record.signedAt)
    )
  }
  return Number.isFinite(record?.invitedAt)
}

/** The last thing that happened to the record, which its life is counted from. */
const latestMomentOf = (record: CardInvestmentRecord): number =>
  isSignedCardInvestment(record) ? record.paidAt ?? record.signedAt : record.invitedAt

const isCurrent = (record: CardInvestmentRecord, now: number): boolean =>
  now - latestMomentOf(record) < CARD_INVESTMENT_LIFETIME_MS

/**
 * The card investment one account opened or signed for and has not closed out, or null
 * when there is none or the one there has lapsed.
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
): CardInvestmentRecord | null => {
  const record = state.cardInvestmentByAccountId?.[accountId]
  return record && isSound(record) && isCurrent(record, now) ? record : null
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
