import { renderHook } from "@testing-library/react-hooks"
import { useStatementsData } from "@app/screens/card-screen/card-statements-screen/hooks/use-statements-data"

const mockUseIsAuthed = jest.fn()
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

const mockFetchMore = jest.fn()
const mockUseCardTransactionsPaginatedQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardTransactionsPaginatedQuery: (opts: Record<string, unknown>) =>
    mockUseCardTransactionsPaginatedQuery(opts),
}))

const mockUseCardData = jest.fn()
jest.mock("@app/hooks/use-card-data", () => ({
  useCardData: () => mockUseCardData(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {},
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

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

const makeEdge = (id: string, createdAt: string, amount = 10) => ({
  cursor: `cursor-${id}`,
  node: {
    id,
    amount,
    currency: "USD",
    merchantName: "Store",
    status: "COMPLETED",
    createdAt,
    cardId: "card-1",
  },
})

const noPageInfo = {
  endCursor: null,
  hasNextPage: false,
  hasPreviousPage: false,
  startCursor: null,
}

describe("useStatementsData", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    mockUseCardData.mockReturnValue({ card: { id: "card-1" } })
    mockFetchMore.mockResolvedValue({ data: {} })
  })

  it("returns empty statements when no data", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
      fetchMore: mockFetchMore,
    })

    const { result } = renderHook(() => useStatementsData())

    expect(result.current.statements).toEqual([])
    expect(result.current.yearOptions).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it("returns grouped statements from edges", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: {
        cardTransactionsPaginated: {
          edges: [
            makeEdge("tx-1", "2025-01-15T10:00:00Z", 20),
            makeEdge("tx-2", "2025-01-20T10:00:00Z", 30),
            makeEdge("tx-3", "2025-02-10T10:00:00Z", 50),
          ],
          pageInfo: noPageInfo,
        },
      },
      loading: false,
      error: undefined,
      fetchMore: mockFetchMore,
    })

    const { result } = renderHook(() => useStatementsData())

    expect(result.current.statements).toHaveLength(2)
    expect(result.current.yearOptions).toHaveLength(1)
    expect(result.current.loading).toBe(false)
  })

  it("deduplicates edges with same id", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: {
        cardTransactionsPaginated: {
          edges: [
            makeEdge("tx-1", "2025-01-15T10:00:00Z"),
            makeEdge("tx-1", "2025-01-15T10:00:00Z"),
          ],
          pageInfo: noPageInfo,
        },
      },
      loading: false,
      error: undefined,
      fetchMore: mockFetchMore,
    })

    const { result } = renderHook(() => useStatementsData())

    expect(result.current.statements).toHaveLength(1)
    expect(result.current.statements[0].transactionCount).toBe(1)
  })

  it("skips query when not authenticated", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
      fetchMore: mockFetchMore,
    })

    renderHook(() => useStatementsData())

    expect(mockUseCardTransactionsPaginatedQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("skips query when no cardId", () => {
    mockUseCardData.mockReturnValue({ card: undefined })
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
      fetchMore: mockFetchMore,
    })

    renderHook(() => useStatementsData())

    expect(mockUseCardTransactionsPaginatedQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("uses page size of 100", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
      fetchMore: mockFetchMore,
    })

    renderHook(() => useStatementsData())

    expect(mockUseCardTransactionsPaginatedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ first: 100 }),
      }),
    )
  })

  it("returns currentYear as current year", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
      fetchMore: mockFetchMore,
    })

    const { result } = renderHook(() => useStatementsData())

    expect(result.current.currentYear).toBe(new Date().getFullYear())
  })

  it("reports loading while hasNextPage is true", () => {
    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: {
        cardTransactionsPaginated: {
          edges: [makeEdge("tx-1", "2025-01-15T10:00:00Z")],
          pageInfo: {
            endCursor: "cursor-1",
            hasNextPage: true,
            hasPreviousPage: false,
            startCursor: "cursor-1",
          },
        },
      },
      loading: false,
      error: undefined,
      fetchMore: mockFetchMore,
    })

    const { result } = renderHook(() => useStatementsData())

    expect(result.current.loading).toBe(true)
  })

  it("shows toast on error", () => {
    const { toastShow } = jest.requireMock("@app/utils/toast")
    const mockError = { message: "Network error" }

    mockUseCardTransactionsPaginatedQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: mockError,
      fetchMore: mockFetchMore,
    })

    renderHook(() => useStatementsData())

    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Network error",
        type: "warning",
      }),
    )
  })
})
