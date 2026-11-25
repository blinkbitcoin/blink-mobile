import { renderHook } from "@testing-library/react-hooks"
import { useCardBalance } from "@app/hooks/use-card-balance"

const mockUseIsAuthed = jest.fn()
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

const mockUseCardCollateralBalanceQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCardCollateralBalanceQuery: (opts: Record<string, unknown>) =>
    mockUseCardCollateralBalanceQuery(opts),
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
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: { cardCollateralBalance: { availableSats: 15000, pendingSats: 0 } },
      loading: false,
      error: undefined,
    })

    const { result } = renderHook(() => useCardBalance())

    expect(result.current.balancePrimary).toBe("0.0015 BTC")
    expect(result.current.balanceSecondary).toBe("~ $100.00")
  })

  it("returns empty strings when display functions return null", () => {
    mockMoneyAmountToDisplayCurrencyString.mockReturnValue(null)
    mockFormatMoneyAmount.mockReturnValue(null)
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: { cardCollateralBalance: { availableSats: 0, pendingSats: 0 } },
      loading: false,
      error: undefined,
    })

    const { result } = renderHook(() => useCardBalance())

    expect(result.current.balancePrimary).toBe("")
    expect(result.current.balanceSecondary).toBe("")
  })

  it("returns loading state", () => {
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
    })

    const { result } = renderHook(() => useCardBalance())

    expect(result.current.loading).toBe(true)
  })

  it("returns error", () => {
    const mockError = new Error("Balance error")
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: mockError,
    })

    const { result } = renderHook(() => useCardBalance())

    expect(result.current.error).toBe(mockError)
  })

  it("skips query when not authenticated", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
    })

    renderHook(() => useCardBalance())

    expect(mockUseCardCollateralBalanceQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("skips the query when the caller has no card to read for", () => {
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
    })

    renderHook(() => useCardBalance({ skip: true }))

    expect(mockUseCardCollateralBalanceQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("reads the member's collateral, which takes no card id", () => {
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
    })

    renderHook(() => useCardBalance())

    const [options] = mockUseCardCollateralBalanceQuery.mock.calls[0]
    expect(options).toEqual(expect.objectContaining({ skip: false }))
    expect(options.variables).toBeUndefined()
  })

  it("hands over what unsettled payments hold", () => {
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: { cardCollateralBalance: { availableSats: 15000, pendingSats: 2500 } },
      loading: false,
      error: undefined,
    })

    const { result } = renderHook(() => useCardBalance())

    expect(result.current.availableSats).toBe(15000)
    expect(result.current.pendingSats).toBe(2500)
  })

  it("uses network-only fetch policy with poll interval", () => {
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
    })

    renderHook(() => useCardBalance())

    expect(mockUseCardCollateralBalanceQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        fetchPolicy: "network-only",
        pollInterval: 30_000,
      }),
    )
  })

  it("leaves availableSats undefined until the balance arrives", () => {
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
    })

    const { result } = renderHook(() => useCardBalance())

    expect(result.current.availableSats).toBeUndefined()
  })

  it("keeps availableSats undefined when the request fails", () => {
    const error = new Error("card balance unavailable")
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error,
    })

    const { result } = renderHook(() => useCardBalance())

    expect(result.current.availableSats).toBeUndefined()
    expect(result.current.error).toBe(error)
  })

  it("reports a confirmed zero balance as zero", () => {
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: { cardCollateralBalance: { availableSats: 0, pendingSats: 0 } },
      loading: false,
      error: undefined,
    })

    const { result } = renderHook(() => useCardBalance())

    expect(result.current.availableSats).toBe(0)
  })

  it("exposes the query refetch", () => {
    const refetch = jest.fn()
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
      refetch,
    })

    const { result } = renderHook(() => useCardBalance())

    expect(result.current.refetch).toBe(refetch)
  })

  it("formats zero while the balance is unknown", () => {
    mockUseCardCollateralBalanceQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
    })

    renderHook(() => useCardBalance())

    expect(mockMoneyAmountToDisplayCurrencyString).toHaveBeenCalledWith(
      expect.objectContaining({
        moneyAmount: expect.objectContaining({ amount: 0 }),
      }),
    )
  })
})
