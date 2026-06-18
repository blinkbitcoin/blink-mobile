import { TransactionStatus } from "@app/graphql/generated"
import { CardTransactionUiStatus } from "@app/components/card-screen/types"
import { groupCardTransactionsByDate } from "@app/screens/card-screen/card-dashboard-screen/group-transactions-by-date"

jest.mock("@app/components/transaction-date/transaction-date", () => ({
  formatDateForTransaction: ({
    createdAt,
  }: {
    createdAt: number
    locale: string
    includeTime: boolean
  }) => `${createdAt}s ago`,
}))

const mockLL = {
  common: {
    today: () => "Today",
    yesterday: () => "Yesterday",
  },
} as Parameters<typeof groupCardTransactionsByDate>[0]["LL"]

const mockFormatCurrency = ({
  amountInMajorUnits,
}: {
  amountInMajorUnits: number
  currency: string
}) => `$${amountInMajorUnits.toFixed(2)}`

const now = new Date()
const todayISO = now.toISOString()
const yesterdayISO = new Date(Date.now() - 86_400_000).toISOString()
const olderISO = new Date("2024-06-15T10:00:00Z").toISOString()

const makeNode = (
  overrides: Partial<{
    id: string
    amount: number
    currency: string
    merchantName: string
    status: TransactionStatus
    createdAt: string
  }> = {},
) => ({
  id: overrides.id ?? "tx-1",
  amount: overrides.amount ?? 10.5,
  currency: overrides.currency ?? "USD",
  merchantName: overrides.merchantName ?? "Test Store",
  status: overrides.status ?? TransactionStatus.Completed,
  createdAt: overrides.createdAt ?? todayISO,
})

describe("groupCardTransactionsByDate", () => {
  it("returns empty array for empty nodes", () => {
    const result = groupCardTransactionsByDate({
      nodes: [],
      LL: mockLL,
      locale: "en",
      formatCurrency: mockFormatCurrency,
    })

    expect(result).toEqual([])
  })

  it("groups a single transaction under Today", () => {
    const result = groupCardTransactionsByDate({
      nodes: [makeNode({ createdAt: todayISO })],
      LL: mockLL,
      locale: "en",
      formatCurrency: mockFormatCurrency,
    })

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe("Today")
    expect(result[0].transactions).toHaveLength(1)
  })

  it("groups multiple transactions under the same date", () => {
    const result = groupCardTransactionsByDate({
      nodes: [
        makeNode({ id: "tx-1", createdAt: todayISO }),
        makeNode({ id: "tx-2", createdAt: todayISO }),
      ],
      LL: mockLL,
      locale: "en",
      formatCurrency: mockFormatCurrency,
    })

    expect(result).toHaveLength(1)
    expect(result[0].transactions).toHaveLength(2)
  })

  it("creates separate groups for different dates", () => {
    const result = groupCardTransactionsByDate({
      nodes: [
        makeNode({ id: "tx-1", createdAt: todayISO }),
        makeNode({ id: "tx-2", createdAt: yesterdayISO }),
      ],
      LL: mockLL,
      locale: "en",
      formatCurrency: mockFormatCurrency,
    })

    expect(result).toHaveLength(2)
    expect(result[0].date).toBe("Today")
    expect(result[1].date).toBe("Yesterday")
  })

  it("formats amount using formatCurrency", () => {
    const result = groupCardTransactionsByDate({
      nodes: [makeNode({ amount: 25.99, currency: "USD" })],
      LL: mockLL,
      locale: "en",
      formatCurrency: mockFormatCurrency,
    })

    expect(result[0].transactions[0].amount).toBe("$25.99")
  })

  it("maps transaction status correctly", () => {
    const result = groupCardTransactionsByDate({
      nodes: [
        makeNode({ id: "tx-1", status: TransactionStatus.Pending }),
        makeNode({ id: "tx-2", status: TransactionStatus.Declined }),
        makeNode({ id: "tx-3", status: TransactionStatus.Reversed }),
        makeNode({ id: "tx-4", status: TransactionStatus.Completed }),
      ],
      LL: mockLL,
      locale: "en",
      formatCurrency: mockFormatCurrency,
    })

    const statuses = result[0].transactions.map((t) => t.status)
    expect(statuses).toEqual([
      CardTransactionUiStatus.Pending,
      CardTransactionUiStatus.Declined,
      CardTransactionUiStatus.Reversed,
      CardTransactionUiStatus.Completed,
    ])
  })

  it("preserves merchant name and id", () => {
    const result = groupCardTransactionsByDate({
      nodes: [makeNode({ id: "unique-id", merchantName: "Coffee Shop" })],
      LL: mockLL,
      locale: "en",
      formatCurrency: mockFormatCurrency,
    })

    const tx = result[0].transactions[0]
    expect(tx.id).toBe("unique-id")
    expect(tx.merchantName).toBe("Coffee Shop")
  })

  it("calls formatDateForTransaction for timeAgo", () => {
    const result = groupCardTransactionsByDate({
      nodes: [makeNode({ createdAt: todayISO })],
      LL: mockLL,
      locale: "en",
      formatCurrency: mockFormatCurrency,
    })

    expect(result[0].transactions[0].timeAgo).toMatch(/\d+s ago/)
  })

  it("handles older dates falling back to month/year label", () => {
    const result = groupCardTransactionsByDate({
      nodes: [makeNode({ createdAt: olderISO })],
      LL: mockLL,
      locale: "en",
      formatCurrency: mockFormatCurrency,
    })

    expect(result).toHaveLength(1)
    expect(result[0].date).not.toBe("Today")
    expect(result[0].date).not.toBe("Yesterday")
  })
})
