import { useCallback, useEffect, useMemo, useRef } from "react"

import {
  TransactionStatus,
  useCardTransactionsPaginatedQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { toastShow } from "@app/utils/toast"

import { useCardData } from "../../hooks/use-card-data"
import { groupTransactionsByMonth } from "../group-transactions-by-month"

const PAGE_SIZE = 100

const EXCLUDED_STATUSES: Set<TransactionStatus> = new Set([
  TransactionStatus.Declined,
  TransactionStatus.Reversed,
])

export const useStatementsData = () => {
  const isAuthed = useIsAuthed()
  const { LL, locale } = useI18nContext()
  const { formatCurrency } = useDisplayCurrency()
  const { card } = useCardData()
  const cardId = card?.id
  const fetchingMoreRef = useRef(false)

  const { data, loading, error, fetchMore } = useCardTransactionsPaginatedQuery({
    variables: { cardId: cardId ?? "", first: PAGE_SIZE },
    skip: !isAuthed || !cardId,
    fetchPolicy: "cache-and-network",
  })

  const cardTransactions = data?.cardTransactionsPaginated
  const pageInfo = cardTransactions?.pageInfo
  const hasNextPage = pageInfo?.hasNextPage ?? false

  const fetchNextPage = useCallback(() => {
    if (fetchingMoreRef.current || !hasNextPage || !pageInfo?.endCursor) return

    fetchingMoreRef.current = true
    fetchMore({
      variables: { after: pageInfo.endCursor },
    }).finally(() => {
      fetchingMoreRef.current = false
    })
  }, [hasNextPage, pageInfo?.endCursor, fetchMore])

  useEffect(() => {
    fetchNextPage()
  }, [fetchNextPage])

  useEffect(() => {
    if (error) {
      toastShow({ message: error.message, type: "warning", LL })
    }
  }, [error, LL])

  const edges = cardTransactions?.edges

  const { statements, yearOptions } = useMemo(() => {
    if (!edges) return { statements: [], yearOptions: [] }

    const seen = new Set<string>()
    const nodes = edges.flatMap(({ node }) => {
      if (seen.has(node.id)) return []
      seen.add(node.id)
      return [{ ...node, excludeFromTotal: EXCLUDED_STATUSES.has(node.status) }]
    })

    const result = groupTransactionsByMonth({ nodes, locale })

    return {
      statements: result.statements.map((statement) => ({
        ...statement,
        totalSpent: formatCurrency({
          amountInMajorUnits: statement.totalAmount,
          currency: statement.currency,
        }),
      })),
      yearOptions: result.yearOptions,
    }
  }, [edges, formatCurrency, locale])

  const currentYear = new Date().getFullYear()

  return {
    statements,
    yearOptions,
    currentYear,
    loading: loading || hasNextPage,
    error,
  }
}
