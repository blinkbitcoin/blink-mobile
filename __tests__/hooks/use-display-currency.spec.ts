import { renderHook } from "@testing-library/react-hooks"

import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { WalletCurrency } from "@app/graphql/generated"
import { toBtcMoneyAmount, toUsdMoneyAmount, DisplayCurrency } from "@app/types/amounts"

const mockUseCurrencyListQuery = jest.fn()
const mockUseIsAuthed = jest.fn()
const mockConvertMoneyAmount = jest.fn()
const mockToDisplayMoneyAmount = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCurrencyListQuery: (options: { skip: boolean }) => mockUseCurrencyListQuery(options),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: mockConvertMoneyAmount(),
    displayCurrency: "USD",
    toDisplayMoneyAmount: mockToDisplayMoneyAmount,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        currencySyncIssue: () => "Currency sync issue",
      },
    },
  }),
}))

describe("useDisplayCurrency", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    mockUseCurrencyListQuery.mockReturnValue({
      data: {
        currencyList: [
          { id: "USD", symbol: "$", fractionDigits: 2 },
          { id: "EUR", symbol: "€", fractionDigits: 2 },
          { id: "NGN", symbol: "₦", fractionDigits: 2 },
        ],
      },
    })
    mockToDisplayMoneyAmount.mockImplementation((amount: number) => ({
      amount,
      currency: DisplayCurrency,
      currencyCode: "USD",
    }))
    mockConvertMoneyAmount.mockReturnValue(null)
  })

  describe("formatMoneyAmount", () => {
    it("should format BTC amount with sats suffix", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toBtcMoneyAmount(1000),
      })

      expect(formatted).toBe("1,000 SAT")
    })

    it("should format USD amount with symbol and decimals", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toUsdMoneyAmount(50000),
      })

      expect(formatted).toBe("$500.00")
    })

    it("should format display currency amount with symbol", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "USD" },
      })

      expect(formatted).toBe("$100.00")
    })

    it("should return empty string for NaN amount", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toBtcMoneyAmount(NaN),
      })

      expect(formatted).toBe("")
    })

    it("should format without symbol when noSymbol is true", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toUsdMoneyAmount(10000),
        noSymbol: true,
      })

      expect(formatted).toBe("100.00")
    })

    it("should format without suffix for BTC when noSuffix is true", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toBtcMoneyAmount(500),
        noSuffix: true,
      })

      expect(formatted).toBe("500")
    })

    it("should add approximate prefix when isApproximate is true", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toUsdMoneyAmount(10000),
        isApproximate: true,
      })

      expect(formatted).toContain("~")
    })

    it("should return currency sync issue message when currency code mismatch", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "EUR" },
      })

      expect(formatted).toBe("Currency sync issue")
    })

    it("should format negative amounts with minus sign", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toUsdMoneyAmount(-10000),
      })

      expect(formatted).toBe("-$100.00")
    })
  })

  describe("moneyAmountToMajorUnitOrSats", () => {
    it("should convert BTC to sats", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const amount = result.current.moneyAmountToMajorUnitOrSats(toBtcMoneyAmount(1000))

      expect(amount).toBe(1000)
    })

    it("should convert USD cents to dollars", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const amount = result.current.moneyAmountToMajorUnitOrSats(toUsdMoneyAmount(10000))

      expect(amount).toBe(100)
    })

    it("should convert display currency minor units to major units", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const amount = result.current.moneyAmountToMajorUnitOrSats({
        amount: 10000,
        currency: DisplayCurrency,
        currencyCode: "USD",
      })

      expect(amount).toBe(100)
    })
  })

  describe("formatCurrency", () => {
    it("should format currency with symbol from currency list", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatCurrency({
        amountInMajorUnits: 100,
        currency: "EUR",
      })

      expect(formatted).toBe("€100.00")
    })

    it("should use currency code as symbol for unknown currency", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatCurrency({
        amountInMajorUnits: 50,
        currency: "GBP",
      })

      expect(formatted).toBe("GBP50.00")
    })

    it("should format without sign when withSign is false", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatCurrency({
        amountInMajorUnits: -100,
        currency: "USD",
        withSign: false,
      })

      expect(formatted).toBe("$100.00")
    })

    it("should append currency code when provided", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatCurrency({
        amountInMajorUnits: 100,
        currency: "USD",
        currencyCode: "USD",
      })

      expect(formatted).toBe("$100.00 USD")
    })
  })

  describe("getCurrencySymbol", () => {
    it("should return symbol for currency in list", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const symbol = result.current.getCurrencySymbol({ currency: "EUR" })

      expect(symbol).toBe("€")
    })

    it("should return currency code as symbol for unknown currency", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const symbol = result.current.getCurrencySymbol({ currency: "JPY" })

      expect(symbol).toBe("JPY")
    })
  })

  describe("getSecondaryAmountIfCurrencyIsDifferent", () => {
    it("should return undefined when wallet currency matches display currency", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const secondaryAmount = result.current.getSecondaryAmountIfCurrencyIsDifferent({
        primaryAmount: toUsdMoneyAmount(10000),
        displayAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "USD" },
        walletAmount: toUsdMoneyAmount(10000),
      })

      expect(secondaryAmount).toBeUndefined()
    })

    it("should return wallet amount when primary is display currency", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const walletAmount = toBtcMoneyAmount(1000)
      const secondaryAmount = result.current.getSecondaryAmountIfCurrencyIsDifferent({
        primaryAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "EUR" },
        displayAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "EUR" },
        walletAmount,
      })

      expect(secondaryAmount).toBe(walletAmount)
    })

    it("should return display amount when primary is wallet currency", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const displayAmount = {
        amount: 10000,
        currency: DisplayCurrency,
        currencyCode: "EUR",
      }
      const secondaryAmount = result.current.getSecondaryAmountIfCurrencyIsDifferent({
        primaryAmount: toBtcMoneyAmount(1000),
        displayAmount,
        walletAmount: toBtcMoneyAmount(1000),
      })

      expect(secondaryAmount).toBe(displayAmount)
    })
  })

  describe("formatDisplayAndWalletAmount", () => {
    it("should format with secondary amount when currencies differ", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatDisplayAndWalletAmount({
        primaryAmount: toBtcMoneyAmount(1000),
        displayAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "EUR" },
        walletAmount: toBtcMoneyAmount(1000),
      })

      expect(formatted).toContain("(")
      expect(formatted).toContain(")")
    })

    it("should format without secondary amount when currencies match", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatDisplayAndWalletAmount({
        primaryAmount: toUsdMoneyAmount(10000),
        displayAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "USD" },
        walletAmount: toUsdMoneyAmount(10000),
      })

      expect(formatted).not.toContain("(")
    })

    it("should use display amount as primary when primary is not provided", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatDisplayAndWalletAmount({
        displayAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "USD" },
        walletAmount: toUsdMoneyAmount(10000),
      })

      expect(formatted).toBe("$100.00")
    })
  })

  describe("moneyAmountToDisplayCurrencyString", () => {
    it("should return undefined when convertMoneyAmount is not available", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.moneyAmountToDisplayCurrencyString({
        moneyAmount: toBtcMoneyAmount(1000),
      })

      expect(formatted).toBeUndefined()
    })

    it("should convert and format money amount to display currency", () => {
      mockConvertMoneyAmount.mockReturnValue(
        jest.fn(() => ({
          amount: 10000,
          currency: DisplayCurrency,
          currencyCode: "USD",
        })),
      )
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.moneyAmountToDisplayCurrencyString({
        moneyAmount: toBtcMoneyAmount(1000),
      })

      expect(formatted).toBe("$100")
    })

    it("should include approximate prefix when isApproximate is true", () => {
      mockConvertMoneyAmount.mockReturnValue(
        jest.fn(() => ({
          amount: 10000,
          currency: DisplayCurrency,
          currencyCode: "USD",
        })),
      )
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.moneyAmountToDisplayCurrencyString({
        moneyAmount: toBtcMoneyAmount(1000),
        isApproximate: true,
      })

      expect(formatted).toContain("~")
    })
  })

  describe("currency info", () => {
    it("should return correct info for USD", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      expect(result.current.currencyInfo[WalletCurrency.Usd]).toEqual({
        symbol: "$",
        minorUnitToMajorUnitOffset: 2,
        showFractionDigits: true,
        currencyCode: "USD",
      })
    })

    it("should return correct info for BTC", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      expect(result.current.currencyInfo[WalletCurrency.Btc]).toEqual({
        symbol: "",
        minorUnitToMajorUnitOffset: 0,
        showFractionDigits: false,
        currencyCode: "SAT",
      })
    })

    it("should return correct info for display currency", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      const info = result.current.currencyInfo[DisplayCurrency]

      expect(info.symbol).toBe("$")
      expect(info.minorUnitToMajorUnitOffset).toBe(2)
      expect(info.currencyCode).toBe("USD")
    })
  })

  describe("properties", () => {
    it("should return correct fraction digits", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      expect(result.current.fractionDigits).toBe(2)
    })

    it("should return correct fiat symbol", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      expect(result.current.fiatSymbol).toBe("$")
    })

    it("should return correct display currency", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      expect(result.current.displayCurrency).toBe("USD")
    })

    it("should return zero display amount", () => {
      mockConvertMoneyAmount.mockReturnValue(null)
      const { result } = renderHook(() => useDisplayCurrency())

      expect(result.current.zeroDisplayAmount).toEqual({
        amount: 0,
        currency: DisplayCurrency,
        currencyCode: "USD",
      })
    })
  })
})
