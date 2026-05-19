import { renderHook } from "@testing-library/react-native"

import { useTotalBalance } from "@app/components/balance-header/use-total-balance"
import { WalletCurrency } from "@app/graphql/generated"

const mockConvertMoneyAmount = jest.fn()
const mockFormatMoneyAmount = jest.fn(
  ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
    `$${(moneyAmount.amount / 100).toFixed(2)}`,
)

jest.mock("@app/hooks", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: mockConvertMoneyAmount() }),
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
})
