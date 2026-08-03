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
  const { getTransactions, loading: contactsLoading } = useContacts()

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
   * Whatever is loaded belongs to the contact it was read for. Pointing the hook at a new
   * one clears it during render, before anything is painted, so the incoming contact is
   * never shown the previous contact's payments while its own first page is in flight.
   */
  const loadedIdentifierRef = React.useRef(paymentIdentifier)
  if (loadedIdentifierRef.current !== paymentIdentifier) {
    loadedIdentifierRef.current = paymentIdentifier
    setTransactions([])
    setCursor(null)
    setHasLoaded(false)
    setHasError(false)
  }

  /**
   * The adapter answers from the wallet it is connected to, so asking before it is ready
   * would resolve empty and flash the empty state at a contact that does have payments.
   */
  const shouldLoad = isEnabled && !contactsLoading

  /**
   * Coming back to the screen restarts from the first page rather than merging into what
   * is already listed: the cursor is an offset into the wallet history, so a payment made
   * while away shifts every later offset and pages read across that boundary would repeat
   * or skip entries.
   */
  useFocusEffect(
    React.useCallback(() => {
      if (!shouldLoad) return undefined

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
    }, [shouldLoad, paymentIdentifier, getTransactions]),
  )

  const canLoadMore = shouldLoad && cursor !== null

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
       */
      .catch(() => undefined)
      .finally(() => {
        if (generation === generationRef.current) isLoadingMoreRef.current = false
      })
  }, [canLoadMore, cursor, getTransactions, paymentIdentifier])

  const isLoadingFirstPage = isEnabled && !hasLoaded

  return {
    transactions,
    isLoading: isLoadingFirstPage,
    hasError,
    loadMore,
  }
}
