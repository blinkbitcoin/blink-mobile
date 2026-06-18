import { renderHook } from "@testing-library/react-hooks"
import { useCardBalance } from "@app/screens/card-screen/card-dashboard-screen/hooks/use-card-balance"

const mockUseIsAuthed = jest.fn()
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

const mockUseCardBalanceQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardBalanceQuery: (opts: Record<string, unknown>) => mockUseCardBalanceQuery(opts),
}))

const mockMoneyAmountToDisplayCurrencyString = jest.fn()
const mockFormatMoneyAmount = jest.fn()
jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    moneyAmountToDisplayCurrencyString: mockMoneyAmountToDisplayCurrencyString,
    formatMoneyAmount: mockFormatMoneyAmount,
  }),
}))

jest.mock("@app/types/amounts", () => ({
  toBtcMoneyAmount: (amount: number) => ({
    amount,
    currency: "BTC",
    currencyCode: "BTC",
  }),
}))

describe("useCardBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    mockMoneyAmountToDisplayCurrencyString.mockReturnValue("~ $100.00")
    mockFormatMoneyAmount.mockReturnValue("0.0015 BTC")
  })

  it("returns formatted balance strings", () => {
    mockUseCardBalanceQuery.mockReturnValue({
      data: { cardBalance: { available: 15000, pending: 0, posted: 15000 } },
      loading: false,
      error: undefined,
    })

    const { result } = renderHook(() => useCardBalance("card-1"))

    expect(result.current.balancePrimary).toBe("~ $100.00")
    expect(result.current.balanceSecondary).toBe("0.0015 BTC")
  })

  it("returns empty strings when display functions return null", () => {
    mockMoneyAmountToDisplayCurrencyString.mockReturnValue(null)
    mockFormatMoneyAmount.mockReturnValue(null)
    mockUseCardBalanceQuery.mockReturnValue({
      data: { cardBalance: { available: 0, pending: 0, posted: 0 } },
      loading: false,
      error: undefined,
    })

    const { result } = renderHook(() => useCardBalance("card-1"))

    expect(result.current.balancePrimary).toBe("")
    expect(result.current.balanceSecondary).toBe("")
  })

  it("returns loading state", () => {
    mockUseCardBalanceQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
    })

    const { result } = renderHook(() => useCardBalance("card-1"))

    expect(result.current.loading).toBe(true)
  })

  it("returns error", () => {
    const mockError = new Error("Balance error")
    mockUseCardBalanceQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: mockError,
    })

    const { result } = renderHook(() => useCardBalance("card-1"))

    expect(result.current.error).toBe(mockError)
  })

  it("skips query when not authenticated", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseCardBalanceQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
    })

    renderHook(() => useCardBalance("card-1"))

    expect(mockUseCardBalanceQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("skips query when cardId is undefined", () => {
    mockUseCardBalanceQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
    })

    renderHook(() => useCardBalance(undefined))

    expect(mockUseCardBalanceQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("uses network-only fetch policy with poll interval", () => {
    mockUseCardBalanceQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
    })

    renderHook(() => useCardBalance("card-1"))

    expect(mockUseCardBalanceQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        fetchPolicy: "network-only",
        pollInterval: 30_000,
      }),
    )
  })

  it("defaults available to 0 when data is null", () => {
    mockUseCardBalanceQuery.mockReturnValue({
      data: { cardBalance: null },
      loading: false,
      error: undefined,
    })

    renderHook(() => useCardBalance("card-1"))

    expect(mockMoneyAmountToDisplayCurrencyString).toHaveBeenCalledWith(
      expect.objectContaining({
        moneyAmount: expect.objectContaining({ amount: 0 }),
      }),
    )
  })
})
