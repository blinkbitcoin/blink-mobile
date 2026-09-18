import { useCallback, useRef } from "react"
import { gql } from "@apollo/client"

import { useCardInvestmentAccountQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getCardInvestment,
  withCardInvestment,
  withoutCardInvestment,
} from "@app/store/persistent-state/card-investment"
import { AccountType } from "@app/types/wallet"
import {
  CardInvestmentProgress,
  isSignedCardInvestment,
} from "@app/types/card-investment"

import { useAccountRegistry } from "./use-account-registry"

gql`
  query cardInvestmentAccount {
    me {
      id
      defaultAccount {
        id
      }
    }
  }
`

/**
 * The account the investment belongs to: its server id, or null while it is not known.
 * The store's active-account slot would not do, since every custodial profile on the
 * device shares it.
 *
 * Custodial only. The investment is paid from the investor's own Blink balance, so a
 * self-custodial account has no part in it: no id to file under, and so no record, no
 * card on the home and no way through the flow.
 */
const useCardInvestmentAccount = (): {
  accountId: string | null
  isEligible: boolean
} => {
  const { activeAccount } = useAccountRegistry()
  const isAuthed = useIsAuthed()
  const isEligible = activeAccount?.type !== AccountType.SelfCustodial

  /** Served from the cache the home already filled; only a fresh session fetches. */
  const { data } = useCardInvestmentAccountQuery({
    skip: !isEligible || !isAuthed,
    fetchPolicy: "cache-first",
  })

  if (!isEligible) return { accountId: null, isEligible }
  return { accountId: data?.me?.defaultAccount?.id ?? null, isEligible }
}

/** What the signing step knows when the agreement is signed. */
type CardInvestmentStart = Pick<
  CardInvestmentProgress,
  "selectedAmountUsd" | "settlementSats"
>

type CardInvestmentProgressState = {
  /** The signed investment, or null while none is: an invitation alone is not one. */
  progress: CardInvestmentProgress | null
  /** Whether the investor opened the invitation and has not signed yet; the home holds
   *  the way back into the flow open while this is so. */
  isInvited: boolean
  /** Whether the active account can take part at all: the investment is paid from a
   *  custodial balance, so a self-custodial account is sent back wherever it enters. */
  isEligible: boolean
  /** Whether the account the record is filed under is known yet; until it is, nothing
   *  can be recorded, so a step that must record should wait on this. Never, for an
   *  account that cannot take part. */
  isAccountResolved: boolean
  /** Records that the invitation was opened, unless the account already holds a record:
   *  a return to the first screen must not erase an agreement already signed. */
  markInvited: () => void
  /** Records the signed agreement, stamped with the moment; the home nags about its
   *  payment from here on. */
  start: (investment: CardInvestmentStart) => void
  /** Records the invoice the transfer step was issued, to be paid rather than reissued
   *  on a return while it can still be paid. */
  recordInvoice: (paymentRequest: string) => void
  /** Records the payment; the home welcomes the investor from here on. */
  markPaid: () => void
  /** Forgets the investment, once the investor has closed the welcome. */
  clear: () => void
}

/**
 * The active account's card investment in progress, and the four moments that move it:
 * opening the invitation, signing, paying, and closing the welcome that follows. Read
 * and written through the persisted state so the home, the flow's screens and the send
 * flow all see the same record.
 *
 * With no account id resolved yet there is nothing to read and nowhere to write, so the
 * moments are dropped rather than filed under a guess.
 */
export const useCardInvestmentProgress = (): CardInvestmentProgressState => {
  const { persistentState, updateState } = usePersistentStateContext()
  const { accountId, isEligible } = useCardInvestmentAccount()
  const record = accountId
    ? getCardInvestment(persistentState, accountId, Date.now())
    : null
  const progress = record && isSignedCardInvestment(record) ? record : null
  const isInvited = record !== null && progress === null

  const markInvited = useCallback(() => {
    if (!accountId) return
    updateState((state) => {
      if (!state) return state
      const now = Date.now()
      if (getCardInvestment(state, accountId, now)) return state
      return withCardInvestment(state, accountId, { invitedAt: now })
    })
  }, [accountId, updateState])

  const start = useCallback(
    (investment: CardInvestmentStart) => {
      if (!accountId) return
      updateState(
        (state) =>
          state &&
          withCardInvestment(state, accountId, { ...investment, signedAt: Date.now() }),
      )
    },
    [accountId, updateState],
  )

  /** Nothing signed means nothing to add to: an invoice or a payment with no signed
   *  investment behind it leaves the record as it is rather than inventing one. */
  const amend = useCallback(
    (change: (current: CardInvestmentProgress) => CardInvestmentProgress) => {
      if (!accountId) return
      updateState((state) => {
        if (!state) return state
        const current = getCardInvestment(state, accountId, Date.now())
        if (!current || !isSignedCardInvestment(current)) return state
        return withCardInvestment(state, accountId, change(current))
      })
    },
    [accountId, updateState],
  )

  const recordInvoice = useCallback(
    (paymentRequest: string) => {
      amend((current) => ({
        ...current,
        invoice: { paymentRequest, issuedAt: Date.now() },
      }))
    },
    [amend],
  )

  const markPaid = useCallback(() => {
    amend((current) => ({ ...current, paidAt: Date.now() }))
  }, [amend])

  const clear = useCallback(() => {
    if (!accountId) return
    updateState((state) => state && withoutCardInvestment(state, accountId))
  }, [accountId, updateState])

  return {
    progress,
    isInvited,
    isEligible,
    isAccountResolved: accountId !== null,
    markInvited,
    start,
    recordInvoice,
    markPaid,
    clear,
  }
}

/**
 * The investment's invoice, armed by the transfer step right before it opens the send
 * flow on it and spent by the receipt that settles that very invoice, so the payment is
 * recorded against the investment without the send flow knowing it is one.
 *
 * Bound to the invoice rather than to the moment: the send flow stays open to other
 * destinations while the transfer step sits underneath, and a payment to anyone else
 * settled in that window must not be recorded as the investment. A module value rather
 * than a route param: the invoice travels through three generic send screens whose
 * params describe the payment, not why it is being made. An arm left behind by an
 * investor who backed out of the send flow is harmless: only a payment of that very
 * invoice can spend it, and that payment is the investment.
 */
let armedCardInvestmentInvoice: string | null = null

/** Bolt11 is case-insensitive and the send flow may hand the invoice back in either. */
const sameInvoice = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

export const armCardInvestmentPayment = (paymentRequest: string): void => {
  armedCardInvestmentInvoice = paymentRequest
}

/**
 * Whether the invoice is the armed one, without spending the arm: for the step that has
 * to decide what an answer about that invoice means before any receipt is shown.
 */
export const isCardInvestmentPaymentArmed = (
  paymentRequest: string | undefined,
): boolean =>
  armedCardInvestmentInvoice !== null &&
  paymentRequest !== undefined &&
  sameInvoice(armedCardInvestmentInvoice, paymentRequest)

/**
 * Whether the settled invoice is the armed one, clearing the arm when it is so one arm
 * records at most one payment. Another invoice leaves the arm alone: the investment's
 * own payment may still follow.
 */
export const consumeCardInvestmentPayment = (
  paymentRequest: string | undefined,
): boolean => {
  const armed = armedCardInvestmentInvoice
  if (!armed || !paymentRequest || !sameInvoice(armed, paymentRequest)) return false
  armedCardInvestmentInvoice = null
  return true
}

/**
 * Whether the screen calling this settles the investment's payment, read once on its
 * first render and held for its lifetime, so an arm set while it is showing is not
 * credited to it. A ref guard rather than a state initializer so StrictMode's double
 * render cannot spend the arm twice.
 */
export const useConsumeCardInvestmentPayment = (
  paymentRequest: string | undefined,
): boolean => {
  const consumedRef = useRef<boolean | null>(null)
  if (consumedRef.current === null) {
    consumedRef.current = consumeCardInvestmentPayment(paymentRequest)
  }
  return consumedRef.current
}
