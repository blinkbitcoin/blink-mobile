import { YearOption } from "@app/components/year-selector"
import { formatMonth, getLastDayOfMonth } from "@app/utils/date"

type TransactionNode = {
  readonly amount: number
  readonly currency: string
  readonly createdAt: string
  readonly excludeFromTotal: boolean
}

type GroupTransactionsParams = {
  nodes: readonly TransactionNode[]
  locale: string
}

type RawStatement = {
  id: string
  month: string
  year: number
  period: string
  transactionCount: number
  totalAmount: number
  currency: string
  isCurrent: boolean
}

type GroupTransactionsResult = {
  statements: RawStatement[]
  yearOptions: YearOption[]
}

type MonthBucket = {
  year: number
  month: number
  totalAmount: number
  currency: string
  count: number
}

export const groupTransactionsByMonth = ({
  nodes,
  locale,
}: GroupTransactionsParams): GroupTransactionsResult => {
  if (nodes.length === 0) {
    return { statements: [], yearOptions: [] }
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const buckets = new Map<string, MonthBucket>()
  const yearCounts = new Map<number, number>()

  for (const node of nodes) {
    const date = new Date(node.createdAt)
    const year = date.getFullYear()
    const month = date.getMonth()
    const key = `${year}-${String(month).padStart(2, "0")}`

    const amountToAdd = node.excludeFromTotal ? 0 : node.amount

    const existing = buckets.get(key)
    if (existing) {
      existing.totalAmount += amountToAdd
      existing.count += 1
    }

    if (!existing) {
      buckets.set(key, {
        year,
        month,
        totalAmount: amountToAdd,
        currency: node.currency,
        count: 1,
      })
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1)
    }
  }

  const statements: RawStatement[] = [...buckets.entries()]
    .sort(([idA], [idB]) => idB.localeCompare(idA))
    .map(([id, bucket]) => {
      const isCurrent = bucket.year === currentYear && bucket.month === currentMonth
      const monthDate = new Date(bucket.year, bucket.month, 1)
      const shortMonth = formatMonth(locale, monthDate, "short")
      const lastDay = getLastDayOfMonth(bucket.year, bucket.month)
      const range = `${shortMonth} 1 - ${shortMonth} ${lastDay}`

      return {
        id,
        month: formatMonth(locale, monthDate, "long"),
        year: bucket.year,
        period: isCurrent ? range : `${range}, ${bucket.year}`,
        transactionCount: bucket.count,
        totalAmount: bucket.totalAmount,
        currency: bucket.currency,
        isCurrent,
      }
    })

  const yearOptions: YearOption[] = [...yearCounts.entries()]
    .sort(([yearA], [yearB]) => yearB - yearA)
    .map(([year, itemCount]) => ({ year, itemCount }))

  return { statements, yearOptions }
}
