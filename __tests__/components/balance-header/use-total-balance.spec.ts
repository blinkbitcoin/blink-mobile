import { renderHook } from "@testing-library/react-native"

import { useTotalBalance } from "@app/components/balance-header/use-total-balance"
import { WalletCurrency } from "@app/graphql/generated"

const mockConvertMoneyAmount = jest.fn()
const mockFormatMoneyAmount = jest.fn(
  ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
    `$${(moneyAmount.amount / 100).toFixed(2)}`,
)
const mockUseStablesatsRestricted = jest.fn()

jest.mock("@app/hooks", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: mockConvertMoneyAmount() }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
}))

jest.mock("@app/hooks/use-stablesats-restricted", () => ({
  useStablesatsRestricted: () => mockUseStablesatsRestricted(),
}))

const wallets = [
  { id: "btc", balance: 1_000_000, walletCurrency: WalletCurrency.Btc },
  { id: "usd", balance: 50_000, walletCurrency: WalletCurrency.Usd },
] as const

describe("useTotalBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseStablesatsRestricted.mockReturnValue(false)
  })

  it("flags isLoading=true while price conversion is bootstrapping (account-switch window)", () => {
    mockConvertMoneyAmount.mockReturnValue(undefined)

    const { result } = renderHook(() => useTotalBalance(wallets))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.formattedBalance).toBe("$0.00")
  })

  it("flags isLoading=false once price conversion resolves", () => {
    mockConvertMoneyAmount.mockReturnValue(({ amount }: { amount: number }) => ({
      amount,
      currency: "DisplayCurrency",
      currencyCode: "USD",
    }))

    const { result } = renderHook(() => useTotalBalance(wallets))

    expect(result.current.isLoading).toBe(false)
  })

  describe("when stablesats is restricted", () => {
    const buildConvertSpy = () =>
      jest.fn(({ amount }: { amount: number }) => ({
        amount,
        currency: "DisplayCurrency",
        currencyCode: "USD",
      }))

    it("forces the USD wallet contribution to zero when computing the total", () => {
      mockUseStablesatsRestricted.mockReturnValue(true)
      const convert = buildConvertSpy()
      mockConvertMoneyAmount.mockReturnValue(convert)

      renderHook(() => useTotalBalance(wallets))

      const usdCalls = convert.mock.calls.filter(
        (args) => (args[0] as unknown as { currencyCode: string }).currencyCode === "USD",
      )
      expect(usdCalls.length).toBeGreaterThan(0)
      expect(usdCalls[0][0]).toEqual(
        expect.objectContaining({ amount: 0, currencyCode: "USD" }),
      )
    })

    it("uses the actual USD balance when not restricted", () => {
      mockUseStablesatsRestricted.mockReturnValue(false)
      const convert = buildConvertSpy()
      mockConvertMoneyAmount.mockReturnValue(convert)

      renderHook(() => useTotalBalance(wallets))

      const usdCalls = convert.mock.calls.filter(
        (args) => (args[0] as unknown as { currencyCode: string }).currencyCode === "USD",
      )
      expect(usdCalls[0][0]).toEqual(
        expect.objectContaining({ amount: 50_000, currencyCode: "USD" }),
      )
    })
  })
})
