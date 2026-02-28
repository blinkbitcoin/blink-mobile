import { useCallback, useMemo, useRef, useState } from "react"
import { gql } from "@apollo/client"

import { useCardTransactionsPaginatedQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"

import { groupCardTransactionsByDate } from "../group-transactions-by-date"

gql`
  query cardTransactionsPaginated($cardId: ID!, $first: Int!, $after: String) {
    cardTransactionsPaginated(cardId: $cardId, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          amount
          currency
          merchantName
          status
          createdAt
          cardId
        }
      }
      pageInfo {
        endCursor
        hasNextPage
        hasPreviousPage
        startCursor
      }
    }
  }
`

const DEFAULT_PAGE_SIZE = 20

export const useCardTransactions = (
  cardId: string | undefined,
  pageSize = DEFAULT_PAGE_SIZE,
) => {
  const isAuthed = useIsAuthed()
  const { LL, locale } = useI18nContext()
  const { formatCurrency } = useDisplayCurrency()
  const fetchingMoreRef = useRef(false)
  const [fetchingMore, setFetchingMore] = useState(false)

  const { data, loading, fetchMore, refetch } = useCardTransactionsPaginatedQuery({
    variables: { cardId: cardId ?? "", first: pageSize },
    skip: !isAuthed || !cardId,
    fetchPolicy: "cache-and-network",
  })

  const edges = data?.cardTransactionsPaginated?.edges
  const pageInfo = data?.cardTransactionsPaginated?.pageInfo
  const hasMore = pageInfo?.hasNextPage ?? false

  const transactions = useMemo(() => {
    if (!edges) return []

    const seen = new Set<string>()
    const nodes = edges.flatMap((edge) => {
      if (seen.has(edge.node.id)) return []
      seen.add(edge.node.id)
      return [edge.node]
    })
    return groupCardTransactionsByDate({ nodes, LL, locale, formatCurrency })
  }, [edges, LL, locale, formatCurrency])

  const handleLoadMore = useCallback(() => {
    if (fetchingMoreRef.current || !hasMore || !pageInfo?.endCursor) return

    fetchingMoreRef.current = true
    setFetchingMore(true)
    fetchMore({
      variables: { after: pageInfo.endCursor },
    }).finally(() => {
      fetchingMoreRef.current = false
      setFetchingMore(false)
    })
  }, [hasMore, pageInfo?.endCursor, fetchMore])

  return { transactions, loading, handleLoadMore, hasMore, fetchingMore, refetch }
}
