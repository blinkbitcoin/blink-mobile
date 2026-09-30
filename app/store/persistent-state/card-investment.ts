import { CardInvestmentProgress } from "@app/types/card-investment"

import { PersistentState } from "./state-migrations"

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

/**
 * The card investment one account signed for, or null when there is none.
 *
 * Keyed by the account's own id, handed in by the caller, rather than by the store's
 * active-account slot: every custodial profile on a device shares that slot, and a
 * signed investment, its invoice and its "paid" mark must never surface on another
 * person's home.
 *
 * A record does not lapse: the agreement is signed for good, and the record is what keeps
 * the flow from being walked a second time. What does age out, the invoice, has its own
 * window, read where the invoice is paid.
 */
export const getCardInvestment = (
  state: PersistentState,
  accountId: string,
): CardInvestmentProgress | null => {
  const progress = state.cardInvestmentByAccountId?.[accountId]
  return progress && isSound(progress) ? progress : null
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

/**
 * The records as they are carried through a logout, when everything else starts over.
 *
 * They are kept, filed by server account id, because a signed agreement outlives the
 * session that signed it and must not be signed again by the same account. What a paid
 * record no longer needs goes: its invoice, a payable claim on the account and the one
 * piece of it worth not leaving on a shared phone. An unpaid record keeps its invoice,
 * since that is what a payment that went through without a receipt is found by. One
 * small entry per account that ever signed is the whole of what remains.
 */
export const withCardInvestmentsPrunedForLogout = (
  state: PersistentState,
): Pick<PersistentState, "cardInvestmentByAccountId"> => {
  const records = state.cardInvestmentByAccountId
  if (!records) return {}

  const pruned = Object.fromEntries(
    Object.entries(records).map(([accountId, progress]) => {
      if (!progress?.paidAt || !progress.invoice) return [accountId, progress]
      const { invoice: _spent, ...settled } = progress
      return [accountId, settled]
    }),
  )
  return { cardInvestmentByAccountId: pruned }
}
