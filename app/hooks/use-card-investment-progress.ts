import { useCallback, useEffect, useMemo, useState } from "react"
import { ApolloClient, gql, useApolloClient } from "@apollo/client"

import { useCardInvestmentAccountQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getCardInvestment,
  withCardInvestment,
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
        wallets {
          id
        }
      }
    }
  }
`

/**
 * The sessions whose server has named the account, by client. A client is one token's
 * session, and every custodial profile on the device restores the same persisted cache
 * into it, so until that session's server answers, the cache can still name the account
 * of the profile used before. Once it has answered, the cache holds this session's
 * account, and reading it from there spares every later screen a request of its own.
 */
const accountAnsweredBy = new WeakSet<ApolloClient<unknown>>()

/** How often a screen still waiting on the account asks again, so one whose request
 *  failed offline is not left without it once the connection is back. */
const ACCOUNT_RETRY_INTERVAL_MS = 15_000

const NO_WALLETS: readonly string[] = []

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
  walletIds: readonly string[]
  isEligible: boolean
  refetchAccount: () => void
} => {
  const { activeAccount } = useAccountRegistry()
  const isAuthed = useIsAuthed()
  const isEligible = activeAccount?.type !== AccountType.SelfCustodial

  /**
   * Asked of the network until this session's server has answered, and only then read
   * from the cache: what the cache held before would let another profile's record be
   * read, shown and paid under this one. Until the answer arrives the id is unknown, and
   * the investment stays out of reach. A screen whose request failed asks again on an
   * interval until it has the answer, and picks up one another screen got on its next
   * render, since it then reads the cache.
   */
  const client = useApolloClient()
  const [answeredClient, setAnsweredClient] = useState<ApolloClient<unknown> | null>(null)
  const hasAnsweredHere = answeredClient === client
  const hasAnsweredElsewhere = accountAnsweredBy.has(client)
  const isAccountAnswered = hasAnsweredHere || hasAnsweredElsewhere
  const accountFetchPolicy = isAccountAnswered ? "cache-first" : "network-only"
  const accountRetryIntervalMs = isAccountAnswered ? 0 : ACCOUNT_RETRY_INTERVAL_MS
  const { data, refetch } = useCardInvestmentAccountQuery({
    skip: !isEligible || !isAuthed,
    fetchPolicy: accountFetchPolicy,
    pollInterval: accountRetryIntervalMs,
  })
  const answeredAccount = data?.me?.defaultAccount
  const answeredAccountId = answeredAccount?.id
  const walletIds = useMemo(
    () => answeredAccount?.wallets.map(({ id }) => id) ?? NO_WALLETS,
    [answeredAccount],
  )

  /** Shared with every later screen of the session, and kept here so this screen stops
   *  asking the moment it has the answer. */
  useEffect(() => {
    if (!answeredAccountId) return
    accountAnsweredBy.add(client)
    setAnsweredClient(client)
  }, [answeredAccountId, client])

  /** For the step that has waited on the id too long: a fetch that failed offline is
   *  only asked again on the interval, so the tap that says "try again" asks at once.
   *  The query is never skipped where that wait happens (an eligible account in a
   *  session), so the refetch runs and its answer lands in the same data the wait
   *  reads. */
  const refetchAccount = useCallback(() => {
    refetch().catch(() => undefined)
  }, [refetch])

  if (!isEligible) {
    return { accountId: null, walletIds: NO_WALLETS, isEligible, refetchAccount }
  }
  return { accountId: answeredAccountId ?? null, walletIds, isEligible, refetchAccount }
}

/** What the signing step knows when the agreement is signed. */
type CardInvestmentStart = Pick<
  CardInvestmentProgress,
  "selectedAmountUsd" | "settlementSats" | "envelopeId"
>

type CardInvestmentProgressState = {
  progress: CardInvestmentProgress | null
  /** Whether the active account can take part at all: the investment is paid from a
   *  custodial balance, so a self-custodial account is sent back wherever it enters. */
  isEligible: boolean
  /** The account the record is filed under, once known: what a payment is filed under
   *  too, so the receiving ledger can tell whose it is. */
  accountId: string | null
  /** The wallets of that account, from the same answer: every one the investment's
   *  payment may have been made from, whatever the send flow may use now. */
  walletIds: readonly string[]
  /** Whether that account is known yet; until it is, nothing can be recorded, so a step
   *  that must record should wait on this. Never, for an account that cannot take part. */
  isAccountResolved: boolean
  /** Asks the server for the account again, for a step whose wait on it has run out. */
  refetchAccount: () => void
  /** Records the signed agreement, stamped with the moment; the home nags about its
   *  payment from here on. Never over an agreement already signed: the record is what
   *  keeps a second one from being signed. */
  start: (investment: CardInvestmentStart) => void
  /** Records the invoice the transfer step was issued, to be paid rather than reissued
   *  on a return while it can still be paid. */
  recordInvoice: (paymentRequest: string) => void
  /** Whether an invoice is the one recorded for the investment: how the send flow,
   *  which pays it like any other, tells the investment's payment from the rest. */
  isInvestmentInvoice: (paymentRequest: string | undefined) => boolean
  /** Records a payment sent and still on its way; the home stops asking for the money
   *  and waits, since the payment can still fail. */
  markPaying: () => void
  /** Records that a payment on its way did not go through after all; the home asks for
   *  the money again. */
  clearPaying: () => void
  /** Records the payment as settled; the home welcomes the investor from here on. */
  markPaid: () => void
  /** Closes the welcome. The record stays, as the mark that this account has signed. */
  dismissWelcome: () => void
}

/**
 * The active account's card investment in progress, and the moments that move it:
 * signing, a payment on its way, the payment settled, and closing the welcome that
 * follows. Read and written through the persisted state so the home, the flow's screens
 * and the send flow all see the same record.
 *
 * With no account id resolved yet there is nothing to read and nowhere to write, so the
 * moments are dropped rather than filed under a guess.
 */
export const useCardInvestmentProgress = (): CardInvestmentProgressState => {
  const { persistentState, updateState } = usePersistentStateContext()
  const { accountId, walletIds, isEligible, refetchAccount } = useCardInvestmentAccount()
  const progress = accountId ? getCardInvestment(persistentState, accountId) : null

  const start = useCallback(
    (investment: CardInvestmentStart) => {
      if (!accountId) return
      updateState((state) => {
        if (!state) return state
        if (getCardInvestment(state, accountId)) return state
        return withCardInvestment(state, accountId, {
          ...investment,
          signedAt: Date.now(),
        })
      })
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
        const current = getCardInvestment(state, accountId)
        if (!current) return state
        const next = change(current)
        return next === current ? state : withCardInvestment(state, accountId, next)
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

  /** A payment already settled is not on its way; the first mark of either stands. */
  const markPaying = useCallback(() => {
    amend((current) =>
      current.paidAt || current.payingAt ? current : { ...current, payingAt: Date.now() },
    )
  }, [amend])

  const clearPaying = useCallback(() => {
    amend((current) => {
      if (current.payingAt === undefined) return current
      const { payingAt: _failed, ...owed } = current
      return owed
    })
  }, [amend])

  /** The first mark stands: a second receipt or a doubled effect must not move it. A
   *  settled payment is no longer on its way. */
  const markPaid = useCallback(() => {
    amend((current) => {
      if (current.paidAt) return current
      const { payingAt: _landed, ...settled } = current
      return { ...settled, paidAt: Date.now() }
    })
  }, [amend])

  const dismissWelcome = useCallback(() => {
    amend((current) =>
      current.welcomeDismissedAt
        ? current
        : { ...current, welcomeDismissedAt: Date.now() },
    )
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

  return {
    progress,
    isEligible,
    accountId,
    walletIds,
    isAccountResolved: accountId !== null,
    refetchAccount,
    start,
    recordInvoice,
    isInvestmentInvoice,
    markPaying,
    clearPaying,
    markPaid,
    dismissWelcome,
  }
}
