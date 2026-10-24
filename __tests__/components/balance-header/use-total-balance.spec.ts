import { renderHook } from "@testing-library/react-native"

import { useTotalBalance } from "@app/components/balance-header/use-total-balance"
import { WalletCurrency } from "@app/graphql/generated"

const mockConvertMoneyAmount = jest.fn()
const mockPriceStatus = jest.fn(() => "ready")
const mockFormatMoneyAmount = jest.fn(
  ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
    `$${(moneyAmount.amount / 100).toFixed(2)}`,
)

jest.mock("@app/hooks", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: mockConvertMoneyAmount(),
    priceStatus: mockPriceStatus(),
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
}))

const wallets = [
  { id: "btc", balance: 1_000_000, walletCurrency: WalletCurrency.Btc },
  { id: "usd", balance: 50_000, walletCurrency: WalletCurrency.Usd },
] as const

describe("useTotalBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPriceStatus.mockReturnValue("ready")
  })

  /** satsBalance feeds thresholds read without consulting isLoading (the backup nudge),
   *  so it must not move when the region verdict lands. Nothing here reads the verdict,
   *  which is what keeps it steady. */
  it("keeps satsBalance steady across the region verdict", () => {
    mockConvertMoneyAmount.mockReturnValue(({ amount }: { amount: number }) => ({
      amount,
      currency: "DisplayCurrency",
      currencyCode: "USD",
    }))

    const { result } = renderHook(() => useTotalBalance(wallets))

    expect(result.current.satsBalance).toBe(1_050_000)
  })

  it("flags isLoading=true while price conversion is bootstrapping (account-switch window)", () => {
    mockConvertMoneyAmount.mockReturnValue(undefined)
    mockPriceStatus.mockReturnValue("pending")

    const { result } = renderHook(() => useTotalBalance(wallets))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.formattedBalance).toBe("$0.00")
  })

  describe("when no rate is coming", () => {
    beforeEach(() => {
      mockConvertMoneyAmount.mockReturnValue(undefined)
      mockPriceStatus.mockReturnValue("unavailable")
      // Formats a BTC amount as sats, the way the real formatter does.
      mockFormatMoneyAmount.mockImplementation(
        ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
          `${moneyAmount.amount} sats`,
      )
    })

    it("shows the Bitcoin balance in sats rather than loading forever", () => {
      // The balance is read from the SDK's own storage, so it is not in doubt — only
      // its price is. Spinning on a conversion that will not arrive hides a number the
      // app already has.
      const { result } = renderHook(() => useTotalBalance(wallets))

      expect(result.current.isLoading).toBe(false)
      expect(result.current.formattedBalance).toBe("1000000 sats")
      expect(result.current.satsBalance).toBe(1_000_000)
    })

    it("leaves the held USD out of the sats figure instead of inventing a rate", () => {
      const { result } = renderHook(() => useTotalBalance(wallets))

      // 1,000,000 sats, not 1,050,000: the USD leg needs the very rate that is
      // missing, and understating a total beats fabricating one.
      expect(result.current.satsBalance).toBe(1_000_000)
      expect(mockConvertMoneyAmount).not.toHaveBeenCalledWith(
        expect.objectContaining({ currency: "USD" }),
      )
    })

    it("reads zero for an account that holds nothing", () => {
      const { result } = renderHook(() => useTotalBalance([]))

      expect(result.current.isLoading).toBe(false)
      expect(result.current.satsBalance).toBe(0)
    })
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

  it("always counts the USD contribution, restricted regions and Anon included", () => {
    const convert = jest.fn(({ amount }: { amount: number }) => ({
      amount,
      currency: "DisplayCurrency",
      currencyCode: "USD",
    }))
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
