import { renderHook } from "@testing-library/react-native"

import { useTotalBalance } from "@app/components/balance-header/use-total-balance"
import { WalletCurrency } from "@app/graphql/generated"

const mockConvertMoneyAmount = jest.fn()
const mockFormatMoneyAmount = jest.fn(
  ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
    `$${(moneyAmount.amount / 100).toFixed(2)}`,
)
const mockUseDollarBalanceRestricted = jest.fn()
const mockIsRegionPending = jest.fn()

jest.mock("@app/hooks", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: mockConvertMoneyAmount() }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceRestricted: () => mockUseDollarBalanceRestricted(),
  useDollarBalanceRestriction: () => ({
    isRestricted: mockUseDollarBalanceRestricted(),
    isRegionPending: mockIsRegionPending(),
  }),
}))

const wallets = [
  { id: "btc", balance: 1_000_000, walletCurrency: WalletCurrency.Btc },
  { id: "usd", balance: 50_000, walletCurrency: WalletCurrency.Usd },
] as const

describe("useTotalBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseDollarBalanceRestricted.mockReturnValue(false)
    mockIsRegionPending.mockReturnValue(false)
  })

  it("holds the header on its loader while the region is pending", () => {
    mockConvertMoneyAmount.mockReturnValue(({ amount }: { amount: number }) => ({
      amount,
      currency: "DisplayCurrency",
      currencyCode: "USD",
    }))
    mockIsRegionPending.mockReturnValue(true)

    const { result } = renderHook(() => useTotalBalance(wallets))

    expect(result.current.isLoading).toBe(true)
  })

  it("keeps the dollars out of satsBalance while the region is pending", () => {
    mockConvertMoneyAmount.mockReturnValue(({ amount }: { amount: number }) => ({
      amount,
      currency: "DisplayCurrency",
      currencyCode: "USD",
    }))
    mockIsRegionPending.mockReturnValue(true)

    const { result } = renderHook(() => useTotalBalance(wallets))

    /** Read without consulting isLoading by the backup nudge, so a pending region must
     *  not inflate it with dollars that vanish once the verdict lands. */
    expect(result.current.satsBalance).toBe(1_000_000)
  })

  it("counts the dollars back into satsBalance once the region settles unrestricted", () => {
    mockConvertMoneyAmount.mockReturnValue(({ amount }: { amount: number }) => ({
      amount,
      currency: "DisplayCurrency",
      currencyCode: "USD",
    }))
    mockIsRegionPending.mockReturnValue(false)

    const { result } = renderHook(() => useTotalBalance(wallets))

    expect(result.current.satsBalance).toBe(1_050_000)
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
      mockUseDollarBalanceRestricted.mockReturnValue(true)
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
      mockUseDollarBalanceRestricted.mockReturnValue(false)
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
