import { useCallback, useMemo } from "react"
import { useApolloClient } from "@apollo/client"

import {
  HomeAuthedDocument,
  HomeAuthedQuery,
  TransactionFragment,
  TxDirection,
  TxStatus,
} from "@app/graphql/generated"

type AccountTransactionsParams = {
  isSelfCustodial: boolean
  transactions?: readonly TransactionFragment[] | null
}

/**
 * The custodial transactions that count as history, newest source first: an incoming
 * transaction only counts once it settles, while an outgoing one counts as soon as it is
 * broadcast. Both the home query and its cached copy are assembled through this, so the
 * badge and the seen state can never disagree on what the account holds.
 */
export const toCustodialTransactions = (
  pendingIncomingTransactions?: readonly TransactionFragment[] | null,
  transactionEdges?: readonly { readonly node: TransactionFragment }[] | null,
): readonly TransactionFragment[] => {
  const pendingTransactions = pendingIncomingTransactions ?? []
  if (!transactionEdges?.length) return pendingTransactions

  const settledTransactions = transactionEdges
    .map((edge) => edge.node)
    .filter(
      (transaction) =>
        transaction.status !== TxStatus.Pending ||
        transaction.direction === TxDirection.Send,
    )
  if (pendingTransactions.length === 0) return settledTransactions

  return [...pendingTransactions, ...settledTransactions]
}

/**
 * Whether a transaction is one the user should be told about. A zero settlement carries no
 * amount to announce, and a fee reimbursement is the ledger's own echo of a send the user
 * was already shown. The badge and the seen state both filter on this, and they have to
 * agree: a transaction one of them counts and the other skips leaves an unseen mark with
 * nothing to clear it, so the rule lives here rather than at each call site.
 */
export const isAnnounceableTransaction = (
  transaction: TransactionFragment,
  feeReimbursementMemo: string,
): boolean =>
  transaction.settlementAmount !== 0 &&
  transaction.memo?.toLowerCase() !== feeReimbursementMemo.toLowerCase()

/**
 * The transactions a caller should read for the active account. A custodial caller may
 * pass nothing and get the cached home query instead, so a screen that never runs that
 * query still sees them. A self-custodial account has no `me` behind that cache, so an
 * empty list there is genuinely empty and must never fall back to custodial data — the
 * seen state and the badge amount both depend on that rule, which is why it lives here
 * rather than being repeated at each call site.
 */
export const useAccountTransactions = ({
  isSelfCustodial,
  transactions,
}: AccountTransactionsParams): readonly TransactionFragment[] => {
  const client = useApolloClient()

  const readCachedTransactions = useCallback((): readonly TransactionFragment[] => {
    const account = client.readQuery<HomeAuthedQuery>({ query: HomeAuthedDocument })?.me
      ?.defaultAccount

    return toCustodialTransactions(
      account?.pendingIncomingTransactions,
      account?.transactions?.edges,
    )
  }, [client])

  return useMemo(() => {
    const hasProvidedTransactions = Boolean(transactions && transactions.length > 0)
    const canReadCachedTransactions = !hasProvidedTransactions && !isSelfCustodial
    if (canReadCachedTransactions) return readCachedTransactions()

    return transactions ?? []
  }, [readCachedTransactions, transactions, isSelfCustodial])
}
