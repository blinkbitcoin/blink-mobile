import { TransactionStatus } from "@app/graphql/generated"
import { formatDateByMonthYear } from "@app/graphql/transactions"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { formatDateForTransaction } from "@app/components/transaction-date/transaction-date"
import type { CardTransactionGroup } from "@app/components/card-screen/types"
import { isToday, isYesterday } from "@app/utils/date"

import { mapTransactionStatus } from "../utils/card-display"

type TransactionNode = {
  readonly id: string
  readonly amount: number
  readonly currency: string
  readonly merchantName: string
  readonly status: TransactionStatus
  readonly createdAt: string
}

const getDateLabel = (
  seconds: number,
  LL: TranslationFunctions,
  locale: string,
): string => {
  if (isToday(seconds)) return LL.common.today()
  if (isYesterday(seconds)) return LL.common.yesterday()
  return formatDateByMonthYear(locale, seconds)
}

export const groupCardTransactionsByDate = ({
  nodes,
  LL,
  locale,
  formatCurrency,
}: {
  nodes: readonly TransactionNode[]
  LL: TranslationFunctions
  locale: string
  formatCurrency: (input: { amountInMajorUnits: number; currency: string }) => string
}): CardTransactionGroup[] => {
  const groupMap: Record<string, CardTransactionGroup> = {}

  for (const node of nodes) {
    const createdAtSeconds = Math.floor(new Date(node.createdAt).getTime() / 1000)

    const dateLabel = getDateLabel(createdAtSeconds, LL, locale)
    if (!groupMap[dateLabel]) {
      groupMap[dateLabel] = { date: dateLabel, transactions: [] }
    }

    groupMap[dateLabel].transactions.push({
      id: node.id,
      merchantName: node.merchantName,
      timeAgo: formatDateForTransaction({
        createdAt: createdAtSeconds,
        locale,
        includeTime: false,
      }),
      amount: formatCurrency({
        amountInMajorUnits: node.amount,
        currency: node.currency,
      }),
      status: mapTransactionStatus(node.status),
    })
  }

  return Object.values(groupMap)
}
