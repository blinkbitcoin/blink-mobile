import { renderHook } from "@testing-library/react-native"

import { RatesStatus, useMonetaryPreferences } from "@app/hooks/use-monetary-preferences"
import { AccountType } from "@app/types/wallet"

const mockConvertMoneyAmount = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: { id: "custodial-default", type: "custodial" },
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    getCurrencySymbol: ({ currency }: { currency: string }) =>
      currency === "USD" ? "$" : currency,
    formatMoneyAmount: jest.fn(),
  }),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: mockConvertMoneyAmount(),
    displayCurrency: "USD",
  }),
}))

describe("useMonetaryPreferences", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns displayCurrency from price conversion", () => {
    mockConvertMoneyAmount.mockReturnValue(jest.fn())

    const { result } = renderHook(() => useMonetaryPreferences())

    expect(result.current.displayCurrency).toBe("USD")
  })

  it("returns fiatSymbol from display currency", () => {
    mockConvertMoneyAmount.mockReturnValue(jest.fn())

    const { result } = renderHook(() => useMonetaryPreferences())

    expect(result.current.fiatSymbol).toBe("$")
  })

  it("returns accountType as custodial", () => {
    mockConvertMoneyAmount.mockReturnValue(jest.fn())

    const { result } = renderHook(() => useMonetaryPreferences())

    expect(result.current.accountType).toBe(AccountType.Custodial)
  })

  it("returns ratesStatus available when convertMoneyAmount exists", () => {
    mockConvertMoneyAmount.mockReturnValue(jest.fn())

    const { result } = renderHook(() => useMonetaryPreferences())

    expect(result.current.ratesStatus).toBe(RatesStatus.Available)
  })

  it("returns ratesStatus unavailable when convertMoneyAmount is falsy", () => {
    mockConvertMoneyAmount.mockReturnValue(null)

    const { result } = renderHook(() => useMonetaryPreferences())

    expect(result.current.ratesStatus).toBe(RatesStatus.Unavailable)
  })
})
