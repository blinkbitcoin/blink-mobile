import * as React from "react"

import { useFocusEffect } from "@react-navigation/native"

import { type NormalizedTransaction } from "@app/types/transaction"

import { useContacts } from "./use-contacts"

type ContactTransactionsResult = {
  transactions: NormalizedTransaction[]
  isLoading: boolean
  hasError: boolean
  loadMore: () => void
}

const dedupeById = (transactions: NormalizedTransaction[]): NormalizedTransaction[] => [
  ...new Map(transactions.map((tx) => [tx.id, tx])).values(),
]

/**
 * Pages a contact's transactions through whichever contact adapter is active, so the
 * screen only has to render what it is handed.
 *
 * Enabling is left to the caller because the custodial screen resolves the same list
 * through its own paginated query and must not run both.
 */
export const useContactTransactions = (
  paymentIdentifier: string,
  isEnabled: boolean,
): ContactTransactionsResult => {
  const { getTransactions } = useContacts()

  const [transactions, setTransactions] = React.useState<NormalizedTransaction[]>([])
  const [cursor, setCursor] = React.useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)

  /**
   * A ref, not state: `onEndReached` can fire twice before React re-renders, and a state
   * flag would still read stale on the second call and fetch the same page twice.
   */
  const isLoadingMoreRef = React.useRef(false)

  /**
   * Bumped every time the first page is re-read. A `loadMore` still in flight from before
   * that read belongs to a cursor that no longer exists, so it compares the generation it
   * captured and drops its answer instead of appending a stale page.
   */
  const generationRef = React.useRef(0)

  /**
   * Mirrors how much is on screen so a rejected page can tell whether the reader has
   * something to lose. Read from callbacks that must not re-run when the list grows.
   */
  const loadedCountRef = React.useRef(0)
  loadedCountRef.current = transactions.length

  /**
   * Whatever is loaded belongs to the contact it was read for. Pointing the hook at a new
   * one clears it during render, before anything is painted, so the incoming contact is
   * never shown the previous contact's payments while its own first page is in flight.
   *
   * The generation moves here rather than only in the focus effect, which runs a paint
   * later: a page resolving in between would otherwise still pass for current and land on
   * the contact that replaced it.
   */
  const loadedIdentifierRef = React.useRef(paymentIdentifier)
  if (loadedIdentifierRef.current !== paymentIdentifier) {
    loadedIdentifierRef.current = paymentIdentifier
    generationRef.current += 1
    isLoadingMoreRef.current = false
    setTransactions([])
    setCursor(null)
    setHasLoaded(false)
    setHasError(false)
  }

  /**
   * Coming back to the screen restarts from the first page rather than merging into what
   * is already listed: the cursor is an offset into the wallet history, so a payment made
   * while away shifts every later offset and pages read across that boundary would repeat
   * or skip entries.
   *
   * Reading does not wait on the contact list: `getTransactions` is keyed by payment
   * identifier and never consults it, so a slow or failed list fetch has no answer to
   * contribute here. Adapter readiness is what matters, and `getTransactions` changes
   * identity when the wallet connects, which re-runs this effect on its own.
   */
  useFocusEffect(
    React.useCallback(() => {
      if (!isEnabled) return undefined

      generationRef.current += 1
      isLoadingMoreRef.current = false

      let isActive = true
      setHasError(false)
      getTransactions(paymentIdentifier)
        .then((page) => {
          if (!isActive) return
          setTransactions(page.transactions)
          setCursor(page.nextCursor)
        })
        .catch(() => {
          if (isActive) setHasError(true)
        })
        .finally(() => {
          if (isActive) setHasLoaded(true)
        })

      return () => {
        isActive = false
      }
    }, [isEnabled, paymentIdentifier, getTransactions]),
  )

  const canLoadMore = isEnabled && cursor !== null

  const loadMore = React.useCallback(() => {
    if (!canLoadMore || isLoadingMoreRef.current) return

    const generation = generationRef.current
    isLoadingMoreRef.current = true

    getTransactions(paymentIdentifier, cursor)
      /**
       * There is no unmount guard here on purpose: since React 18 a state write on an
       * unmounted component is a silent no-op, so an `isMounted` ref would guard nothing
       * while adding a flag that a re-run can leave stuck in the wrong position.
       */
      .then((page) => {
        if (generation !== generationRef.current) return
        setTransactions((previous) => dedupeById([...previous, ...page.transactions]))
        setCursor(page.nextCursor)
      })
      /**
       * A page that fails leaves the cursor untouched and the list intact, so the reader
       * keeps what they were already looking at and the next scroll retries. Wiping the
       * screen over a page they have not seen yet would cost them the one they had.
       *
       * With nothing on screen there is nothing to protect, and no list to scroll into a
       * retry either, so that failure is reported instead of swallowed.
       */
      .catch(() => {
        if (generation !== generationRef.current) return
        if (loadedCountRef.current === 0) setHasError(true)
      })
      .finally(() => {
        if (generation === generationRef.current) isLoadingMoreRef.current = false
      })
  }, [canLoadMore, cursor, getTransactions, paymentIdentifier])

  /**
   * A page can come back with nothing for this contact and still leave more history to
   * read, because matching happens on the client and a request stops at its page budget.
   * An empty list has nothing to scroll, so no `onEndReached` will ever ask for the rest:
   * it keeps reading here until something shows up or the history runs out.
   *
   * That budget bounds one request, not this walk. A contact with no payments in a large
   * wallet is therefore read to the end, one round per 100 raw payments — some 100 rounds
   * behind the spinner for a 10,000-payment wallet. It is the deliberate trade-off: giving
   * up early would claim the contact has no transactions while history is still unread,
   * and an empty list leaves the reader no scroll to resume the search with.
   */
  const hasNothingToScroll = transactions.length === 0 && cursor !== null

  React.useEffect(() => {
    if (hasNothingToScroll) loadMore()
  }, [hasNothingToScroll, loadMore])

  /**
   * Still loading while it has nothing to show and more to read, so the reader sees the
   * search continue rather than an empty state that is about to be replaced.
   */
  const hasSettled = hasLoaded && !hasNothingToScroll
  const isLoadingFirstPage = isEnabled && !hasSettled

  return {
    transactions,
    isLoading: isLoadingFirstPage,
    hasError,
    loadMore,
  }
}
