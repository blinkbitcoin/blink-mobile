import { useCallback } from "react"
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
import { CardInvestmentProgress } from "@app/types/card-investment"

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
  refetchAccount: () => void
} => {
  const { activeAccount } = useAccountRegistry()
  const isAuthed = useIsAuthed()
  const isEligible = activeAccount?.type !== AccountType.SelfCustodial

  /** Served from the cache the home already filled; only a fresh session fetches. */
  const { data, refetch } = useCardInvestmentAccountQuery({
    skip: !isEligible || !isAuthed,
    fetchPolicy: "cache-first",
  })

  /** For the step that has waited on the id too long: a fetch that failed, offline, is
   *  not retried on its own, so the tap that says "try again" asks for it again. */
  const refetchAccount = useCallback(() => {
    refetch().catch(() => undefined)
  }, [refetch])

  if (!isEligible) return { accountId: null, isEligible, refetchAccount }
  return { accountId: data?.me?.defaultAccount?.id ?? null, isEligible, refetchAccount }
}

/** What the signing step knows when the agreement is signed. */
type CardInvestmentStart = Pick<
  CardInvestmentProgress,
  "selectedAmountUsd" | "settlementSats"
>

type CardInvestmentProgressState = {
  progress: CardInvestmentProgress | null
  /** Whether the active account can take part at all: the investment is paid from a
   *  custodial balance, so a self-custodial account is sent back wherever it enters. */
  isEligible: boolean
  /** The account the record is filed under, once known: what a payment is filed under
   *  too, so the receiving ledger can tell whose it is. */
  accountId: string | null
  /** Whether that account is known yet; until it is, nothing can be recorded, so a step
   *  that must record should wait on this. Never, for an account that cannot take part. */
  isAccountResolved: boolean
  /** Asks the server for the account again, for a step whose wait on it has run out. */
  refetchAccount: () => void
  /** Records the signed agreement, stamped with the moment; the home nags about its
   *  payment from here on. */
  start: (investment: CardInvestmentStart) => void
  /** Records which of the server's invitation bulletins the signature answered, so the
   *  home can tell it from a later invitation. */
  recordInvitationBulletin: (notificationId: string) => void
  /** Records the invoice the transfer step was issued, to be paid rather than reissued
   *  on a return while it can still be paid. */
  recordInvoice: (paymentRequest: string) => void
  /** Whether an invoice is the one recorded for the investment: how the send flow,
   *  which pays it like any other, tells the investment's payment from the rest. */
  isInvestmentInvoice: (paymentRequest: string | undefined) => boolean
  /** Records the payment; the home welcomes the investor from here on. */
  markPaid: () => void
  /** Forgets the investment: once the investor has closed the welcome, or once a new
   *  invitation has superseded it. The latter names the signature it decided on, so an
   *  agreement signed while it was deciding is not the one forgotten. */
  clear: (options?: { onlyIfSignedAt: number }) => void
}

/**
 * The active account's card investment in progress, and the three moments that move it:
 * signing, paying, and closing the welcome that follows. Read and written through the
 * persisted state so the home, the signing step and the send flow all see the same record.
 *
 * With no account id resolved yet there is nothing to read and nowhere to write, so the
 * moments are dropped rather than filed under a guess.
 */
export const useCardInvestmentProgress = (): CardInvestmentProgressState => {
  const { persistentState, updateState } = usePersistentStateContext()
  const { accountId, isEligible, refetchAccount } = useCardInvestmentAccount()
  const progress = accountId
    ? getCardInvestment(persistentState, accountId, Date.now())
    : null

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

  /** Nothing signed means nothing to add to: an invoice or a payment with no investment
   *  behind it leaves the record as it is rather than inventing one. A change that hands
   *  the record back unchanged leaves the state as it is too, so nothing is written. */
  const amend = useCallback(
    (change: (current: CardInvestmentProgress) => CardInvestmentProgress) => {
      if (!accountId) return
      updateState((state) => {
        if (!state) return state
        const current = getCardInvestment(state, accountId, Date.now())
        if (!current) return state
        const next = change(current)
        return next === current ? state : withCardInvestment(state, accountId, next)
      })
    },
    [accountId, updateState],
  )

  /** The first one written stands: a signature answers one invitation, and a lookup
   *  repeated after the record was written must not move it to another. */
  const recordInvitationBulletin = useCallback(
    (notificationId: string) => {
      amend((current) =>
        current.invitationBulletinId
          ? current
          : { ...current, invitationBulletinId: notificationId },
      )
    },
    [amend],
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

  /** The first mark stands: the moment is one the record's day is counted from, and
   *  a second receipt or a doubled effect must not move it. */
  const markPaid = useCallback(() => {
    amend((current) => (current.paidAt ? current : { ...current, paidAt: Date.now() }))
  }, [amend])

  /**
   * Read off the record rather than off a flag set on the way into the send flow, so
   * it holds through the send flow's three generic screens, a payment to anyone else
   * made in between, and an app killed with the payment in flight. Bolt11 is
   * case-insensitive and the send flow may hand the invoice back in either.
   */
  const isInvestmentInvoice = useCallback(
    (paymentRequest: string | undefined): boolean => {
      const issued = progress?.invoice?.paymentRequest
      if (issued === undefined || paymentRequest === undefined) return false
      return issued.toLowerCase() === paymentRequest.toLowerCase()
    },
    [progress],
  )

  const clear = useCallback(
    (options?: { onlyIfSignedAt: number }) => {
      if (!accountId) return
      updateState((state) => {
        if (!state) return state
        if (options) {
          const current = getCardInvestment(state, accountId, Date.now())
          if (current?.signedAt !== options.onlyIfSignedAt) return state
        }
        return withoutCardInvestment(state, accountId)
      })
    },
    [accountId, updateState],
  )

  return {
    progress,
    isEligible,
    accountId,
    isAccountResolved: accountId !== null,
    refetchAccount,
    start,
    recordInvitationBulletin,
    recordInvoice,
    isInvestmentInvoice,
    markPaid,
    clear,
  }
}
