import { renderHook } from "@testing-library/react-hooks"
import { useTotalBalance } from "@app/components/balance-header/use-total-balance"
import { WalletCurrency } from "@app/graphql/generated"

const mockFormatMoneyAmount = jest.fn()
jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: mockFormatMoneyAmount,
  }),
}))

const mockConvertMoneyAmount = jest.fn()
jest.mock("@app/hooks", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: mockConvertMoneyAmount,
  }),
}))

const mockBtcWallet = { id: "btc-1", balance: 100000, walletCurrency: WalletCurrency.Btc }
const mockUsdWallet = { id: "usd-1", balance: 500, walletCurrency: WalletCurrency.Usd }
const mockWallets = [mockBtcWallet, mockUsdWallet]

const makeDisplayAmount = (amount: number) => ({
  amount,
  currency: "DisplayCurrency" as const,
  currencyCode: "USD",
})

describe("useTotalBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConvertMoneyAmount.mockImplementation((moneyAmount) =>
      makeDisplayAmount(moneyAmount.amount),
    )
    mockFormatMoneyAmount.mockImplementation(({ noSymbol } = {}) =>
      noSymbol ? "100.00" : "$100.00",
    )
  })

  it("returns formatted total balance from wallets", () => {
    const { result } = renderHook(() => useTotalBalance(mockWallets))

    expect(result.current.formattedBalance).toBe("$100.00")
  })

  it("parses numericBalance from noSymbol/noSuffix format call", () => {
    mockFormatMoneyAmount.mockImplementation(({ noSymbol } = {}) =>
      noSymbol ? "150.50" : "$150.50",
    )

    const { result } = renderHook(() => useTotalBalance(mockWallets))

    expect(result.current.numericBalance).toBe(150.5)
  })

  it("includes card balance in total when cardBalanceSats is provided", () => {
    // btc=100000, usd=500, card=50000 → total display amount = 150500
    const { result } = renderHook(() => useTotalBalance(mockWallets, 50000))

    expect(mockFormatMoneyAmount).toHaveBeenCalledWith(
      expect.objectContaining({
        moneyAmount: expect.objectContaining({ amount: 150500 }),
      }),
    )
    expect(result.current.formattedBalance).toBe("$100.00")
  })

  it("includes card balance when cardBalanceSats is 0", () => {
    // 0 is a defined value — card row with zero balance should still be part of the total
    renderHook(() => useTotalBalance(mockWallets, 0))

    expect(mockFormatMoneyAmount).toHaveBeenCalledWith(
      expect.objectContaining({
        moneyAmount: expect.objectContaining({ amount: 100500 }),
      }),
    )
  })

  it("excludes card from total when cardBalanceSats is undefined", () => {
    renderHook(() => useTotalBalance(mockWallets, undefined))

    expect(mockFormatMoneyAmount).toHaveBeenCalledWith(
      expect.objectContaining({
        moneyAmount: expect.objectContaining({ amount: 100500 }),
      }),
    )
  })

  it("returns zero defaults when conversion is unavailable", () => {
    mockConvertMoneyAmount.mockReturnValue(undefined)

    const { result } = renderHook(() => useTotalBalance(mockWallets))

    expect(result.current.formattedBalance).toBe("$0.00")
    expect(result.current.numericBalance).toBe(0)
    expect(result.current.satsBalance).toBe(0)
  })

  it("returns zero defaults when wallets are undefined", () => {
    mockConvertMoneyAmount.mockReturnValue(undefined)

    const { result } = renderHook(() => useTotalBalance(undefined))

    expect(result.current.formattedBalance).toBe("$0.00")
    expect(result.current.numericBalance).toBe(0)
    expect(result.current.satsBalance).toBe(0)
  })

  it("satsBalance uses btcWallet balance directly for BTC-only accounts", () => {
    const btcOnlyWallets = [
      { id: "btc-1", balance: 200000, walletCurrency: WalletCurrency.Btc },
    ]

    const { result } = renderHook(() => useTotalBalance(btcOnlyWallets))

    // usdWallet.balance is 0/undefined → satsBalance = btcWallet.balance
    expect(result.current.satsBalance).toBe(200000)
  })
})
