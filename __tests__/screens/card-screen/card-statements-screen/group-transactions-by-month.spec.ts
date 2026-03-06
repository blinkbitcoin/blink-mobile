import { groupTransactionsByMonth } from "@app/screens/card-screen/card-statements-screen/group-transactions-by-month"

const makeNode = (overrides: {
  amount?: number
  currency?: string
  createdAt: string
  excludeFromTotal?: boolean
}) => ({
  amount: overrides.amount ?? 10,
  currency: overrides.currency ?? "USD",
  createdAt: overrides.createdAt,
  excludeFromTotal: overrides.excludeFromTotal ?? false,
})

describe("groupTransactionsByMonth", () => {
  it("returns empty results for empty nodes", () => {
    const result = groupTransactionsByMonth({
      nodes: [],
      locale: "en",
    })

    expect(result).toEqual({ statements: [], yearOptions: [] })
  })

  it("groups a single transaction into one statement", () => {
    const result = groupTransactionsByMonth({
      nodes: [makeNode({ amount: 50, createdAt: "2025-03-15T10:00:00Z" })],
      locale: "en",
    })

    expect(result.statements).toHaveLength(1)
    expect(result.statements[0].year).toBe(2025)
    expect(result.statements[0].totalAmount).toBe(50)
    expect(result.statements[0].currency).toBe("USD")
    expect(result.statements[0].transactionCount).toBe(1)
  })

  it("groups multiple transactions in the same month", () => {
    const result = groupTransactionsByMonth({
      nodes: [
        makeNode({ amount: 20, createdAt: "2025-03-05T10:00:00Z" }),
        makeNode({ amount: 30, createdAt: "2025-03-15T10:00:00Z" }),
        makeNode({ amount: 50, createdAt: "2025-03-25T10:00:00Z" }),
      ],
      locale: "en",
    })

    expect(result.statements).toHaveLength(1)
    expect(result.statements[0].totalAmount).toBe(100)
    expect(result.statements[0].transactionCount).toBe(3)
  })

  it("creates separate statements for different months", () => {
    const result = groupTransactionsByMonth({
      nodes: [
        makeNode({ createdAt: "2025-01-10T10:00:00Z" }),
        makeNode({ createdAt: "2025-02-10T10:00:00Z" }),
        makeNode({ createdAt: "2025-03-10T10:00:00Z" }),
      ],
      locale: "en",
    })

    expect(result.statements).toHaveLength(3)
  })

  it("sorts statements newest first", () => {
    const result = groupTransactionsByMonth({
      nodes: [
        makeNode({ createdAt: "2025-01-10T10:00:00Z" }),
        makeNode({ createdAt: "2025-03-10T10:00:00Z" }),
        makeNode({ createdAt: "2025-02-10T10:00:00Z" }),
      ],
      locale: "en",
    })

    expect(result.statements[0].id).toBe("2025-02")
    expect(result.statements[1].id).toBe("2025-01")
    expect(result.statements[2].id).toBe("2025-00")
  })

  it("marks current month as isCurrent", () => {
    const now = new Date()
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 15)

    const result = groupTransactionsByMonth({
      nodes: [makeNode({ createdAt: currentMonthDate.toISOString() })],
      locale: "en",
    })

    expect(result.statements[0].isCurrent).toBe(true)
  })

  it("marks past months as not isCurrent", () => {
    const result = groupTransactionsByMonth({
      nodes: [makeNode({ createdAt: "2020-06-15T10:00:00Z" })],
      locale: "en",
    })

    expect(result.statements[0].isCurrent).toBe(false)
  })

  it("includes year in period for past months", () => {
    const result = groupTransactionsByMonth({
      nodes: [
        makeNode({ createdAt: "2024-06-05T10:00:00Z" }),
        makeNode({ createdAt: "2024-06-20T10:00:00Z" }),
      ],
      locale: "en",
    })

    expect(result.statements[0].period).toContain("2024")
  })

  it("uses first and last day of month for current month without year", () => {
    const now = new Date()
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 10)
    const monthLabel = now.toLocaleString("en", { month: "short" })
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    const result = groupTransactionsByMonth({
      nodes: [makeNode({ createdAt: currentMonthDate.toISOString() })],
      locale: "en",
    })

    expect(result.statements[0].period).toBe(`${monthLabel} 1 - ${monthLabel} ${lastDay}`)
  })

  it("derives year options with correct counts", () => {
    const result = groupTransactionsByMonth({
      nodes: [
        makeNode({ createdAt: "2025-01-10T10:00:00Z" }),
        makeNode({ createdAt: "2025-02-10T10:00:00Z" }),
        makeNode({ createdAt: "2024-06-10T10:00:00Z" }),
      ],
      locale: "en",
    })

    expect(result.yearOptions).toHaveLength(2)
    expect(result.yearOptions[0]).toEqual({ year: 2025, itemCount: 2 })
    expect(result.yearOptions[1]).toEqual({ year: 2024, itemCount: 1 })
  })

  it("sorts year options newest first", () => {
    const result = groupTransactionsByMonth({
      nodes: [
        makeNode({ createdAt: "2023-01-10T10:00:00Z" }),
        makeNode({ createdAt: "2025-01-10T10:00:00Z" }),
        makeNode({ createdAt: "2024-01-10T10:00:00Z" }),
      ],
      locale: "en",
    })

    expect(result.yearOptions.map((y) => y.year)).toEqual([2025, 2024, 2023])
  })

  it("uses first and last day of month for past months", () => {
    const result = groupTransactionsByMonth({
      nodes: [
        makeNode({ createdAt: "2024-06-03T10:00:00Z" }),
        makeNode({ createdAt: "2024-06-25T10:00:00Z" }),
      ],
      locale: "en",
    })

    expect(result.statements[0].period).toBe("Jun 1 - Jun 30, 2024")
  })

  it("counts excluded transactions but excludes them from total", () => {
    const result = groupTransactionsByMonth({
      nodes: [
        makeNode({ amount: 100, createdAt: "2024-06-05T10:00:00Z" }),
        makeNode({
          amount: 50,
          createdAt: "2024-06-15T10:00:00Z",
          excludeFromTotal: true,
        }),
      ],
      locale: "en",
    })

    expect(result.statements[0].transactionCount).toBe(2)
    expect(result.statements[0].totalAmount).toBe(100)
  })

  it("generates unique id from year-month", () => {
    const result = groupTransactionsByMonth({
      nodes: [makeNode({ createdAt: "2025-07-15T10:00:00Z" })],
      locale: "en",
    })

    expect(result.statements[0].id).toBe("2025-06")
  })
})
