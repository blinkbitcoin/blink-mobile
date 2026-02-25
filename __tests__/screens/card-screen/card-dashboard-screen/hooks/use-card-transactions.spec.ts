import { renderHook, act } from "@testing-library/react-hooks"
import { useCardTransactions } from "@app/screens/card-screen/card-dashboard-screen/hooks/use-card-transactions"

const mockUseIsAuthed = jest.fn()
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

const mockFetchMore = jest.fn()
const mockRefetch = jest.fn()
const mockUseCardTransactionsPaginatedQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardTransactionsPaginatedQuery: (opts: Record<string, unknown>) =>
    mockUseCardTransactionsPaginatedQuery(opts),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        today: () => "Today",
        yesterday: () => "Yesterday",
      },
    },
    locale: "en",
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatCurrency: ({
      amountInMajorUnits,
    }: {
      amountInMajorUnits: number
      currency: string
    }) => `$${amountInMajorUnits.toFixed(2)}`,
  }),
}))

jest.mock("@app/components/transaction-date/transaction-date", () => ({
  formatDateForTransaction: () => "2 hours ago",
}))

const makeEdge = (id: string, merchantName = "Store") => ({
  cursor: `cursor-${id}`,
  node: {
    id,
    amount: 10.5,
    currency: "USD",
    merchantName,
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
    cardId: "card-1",
  },
})

describe("useCardTransactions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    mockFetchMore.mockResolvedValue({ data: {} })
  })

  it("returns empty transactions when no data", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: true,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    })

    const { result } = renderHook(() => useCardTransactions("card-1"))

    expect(result.current.transactions).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it("returns grouped transactions from edges", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: {
        cardTransactionsPaginated: {
          edges: [makeEdge("tx-1", "Coffee Shop"), makeEdge("tx-2", "Grocery")],
          pageInfo: {
            endCursor: "cursor-2",
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: "cursor-1",
          },
        },
      },
      loading: false,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    })

    const { result } = renderHook(() => useCardTransactions("card-1"))

    expect(result.current.transactions.length).toBeGreaterThan(0)
    const allTxs = result.current.transactions.flatMap((g) => g.transactions)
    expect(allTxs).toHaveLength(2)
    expect(allTxs[0].merchantName).toBe("Coffee Shop")
    expect(allTxs[1].merchantName).toBe("Grocery")
  })

  it("deduplicates edges with same id", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: {
        cardTransactionsPaginated: {
          edges: [makeEdge("tx-1", "Store A"), makeEdge("tx-1", "Store A")],
          pageInfo: {
            endCursor: "cursor-1",
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: "cursor-1",
          },
        },
      },
      loading: false,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    })

    const { result } = renderHook(() => useCardTransactions("card-1"))

    const allTxs = result.current.transactions.flatMap((g) => g.transactions)
    expect(allTxs).toHaveLength(1)
  })

  it("skips query when not authenticated", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: false,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    })

    renderHook(() => useCardTransactions("card-1"))

    expect(mockUseCardTransactionsPaginatedQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("skips query when cardId is undefined", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: false,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    })

    renderHook(() => useCardTransactions(undefined))

    expect(mockUseCardTransactionsPaginatedQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("uses cache-and-network fetch policy", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: true,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    })

    renderHook(() => useCardTransactions("card-1"))

    expect(mockUseCardTransactionsPaginatedQuery).toHaveBeenCalledWith(
      expect.objectContaining({ fetchPolicy: "cache-and-network" }),
    )
  })

  it("handleLoadMore calls fetchMore when hasNextPage", async () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: {
        cardTransactionsPaginated: {
          edges: [makeEdge("tx-1")],
          pageInfo: {
            endCursor: "cursor-1",
            hasNextPage: true,
            hasPreviousPage: false,
            startCursor: "cursor-1",
          },
        },
      },
      loading: false,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    })

    const { result } = renderHook(() => useCardTransactions("card-1"))

    await act(async () => {
      result.current.handleLoadMore()
    })

    expect(mockFetchMore).toHaveBeenCalledWith({
      variables: { after: "cursor-1" },
    })
  })

  it("handleLoadMore does not call fetchMore when no more pages", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: {
        cardTransactionsPaginated: {
          edges: [makeEdge("tx-1")],
          pageInfo: {
            endCursor: "cursor-1",
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: "cursor-1",
          },
        },
      },
      loading: false,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    })

    const { result } = renderHook(() => useCardTransactions("card-1"))

    result.current.handleLoadMore()

    expect(mockFetchMore).not.toHaveBeenCalled()
  })

  it("uses default page size of 20", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: true,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    })

    renderHook(() => useCardTransactions("card-1"))

    expect(mockUseCardTransactionsPaginatedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ first: 20 }),
      }),
    )
  })

  it("accepts custom page size", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: true,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    })

    renderHook(() => useCardTransactions("card-1", 5))

    expect(mockUseCardTransactionsPaginatedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ first: 5 }),
      }),
    )
  })

  it("returns refetch function", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: false,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    })

    const { result } = renderHook(() => useCardTransactions("card-1"))

    expect(result.current.refetch).toBe(mockRefetch)
  })
})
