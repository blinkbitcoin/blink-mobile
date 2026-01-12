import { renderHook } from "@testing-library/react-hooks"

import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { DisplayCurrency, toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"

const mockUseCurrencyListQuery = jest.fn()
const mockUseIsAuthed = jest.fn()
const mockUsePriceConversion = jest.fn()
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
  usePriceConversion: () => mockUsePriceConversion(),
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

const setCurrencyList = (
  currencyList: Array<{ id: string; symbol: string; fractionDigits: number }>,
) => {
  mockUseCurrencyListQuery.mockReturnValue({
    data: {
      currencyList,
    },
  })
}

const setPriceConversion = ({
  displayCurrency,
  convertMoneyAmount,
}: {
  displayCurrency: string
  convertMoneyAmount?: typeof mockConvertMoneyAmount
}) => {
  mockUsePriceConversion.mockReturnValue({
    displayCurrency,
    toDisplayMoneyAmount: mockToDisplayMoneyAmount,
    ...(convertMoneyAmount ? { convertMoneyAmount } : {}),
  })
}

describe("useDisplayCurrency", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIsAuthed.mockReturnValue(true)
    setCurrencyList([
      { id: "USD", symbol: "$", fractionDigits: 2 },
      { id: "EUR", symbol: "€", fractionDigits: 2 },
      { id: "NGN", symbol: "₦", fractionDigits: 2 },
    ])
    mockToDisplayMoneyAmount.mockImplementation((amount: number) => ({
      amount,
      currency: DisplayCurrency,
      currencyCode: "USD",
    }))
    setPriceConversion({ displayCurrency: "USD" })
  })

  describe("moneyAmountToMajorUnitOrSats", () => {
    it("with 0 digits", () => {
      setCurrencyList([{ id: "JPY", symbol: "¥", fractionDigits: 0 }])
      mockToDisplayMoneyAmount.mockImplementation((amount: number) => ({
        amount,
        currency: DisplayCurrency,
        currencyCode: "JPY",
      }))
      setPriceConversion({ displayCurrency: "JPY" })

      const { result } = renderHook(() => useDisplayCurrency())

      const res = result.current.moneyAmountToMajorUnitOrSats({
        amount: 100,
        currency: DisplayCurrency,
        currencyCode: "JPY",
      })

      expect(res).toBe(100)
    })

    it("with 2 digits", () => {
      mockToDisplayMoneyAmount.mockImplementation((amount: number) => ({
        amount,
        currency: DisplayCurrency,
        currencyCode: "NGN",
      }))
      setPriceConversion({ displayCurrency: "NGN" })

      const { result } = renderHook(() => useDisplayCurrency())

      const res = result.current.moneyAmountToMajorUnitOrSats({
        amount: 10,
        currency: DisplayCurrency,
        currencyCode: "NGN",
      })

      expect(res).toBe(0.1)
    })

    it("should convert BTC to sats", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const amount = result.current.moneyAmountToMajorUnitOrSats(toBtcMoneyAmount(1000))

      expect(amount).toBe(1000)
    })

    it("should convert USD cents to dollars", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const amount = result.current.moneyAmountToMajorUnitOrSats(toUsdMoneyAmount(10000))

      expect(amount).toBe(100)
    })

    it("should convert display currency minor units to major units", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const amount = result.current.moneyAmountToMajorUnitOrSats({
        amount: 10000,
        currency: DisplayCurrency,
        currencyCode: "USD",
      })

      expect(amount).toBe(100)
    })
  })

  it("unAuthed should return default value", () => {
    mockUseIsAuthed.mockReturnValue(false)
    setCurrencyList([])
    setPriceConversion({ displayCurrency: "USD" })

    const { result } = renderHook(() => useDisplayCurrency())

    expect(result.current).toMatchObject({
      fractionDigits: 2,
      fiatSymbol: "$",
      displayCurrency: "USD",
    })
  })

  it("authed but empty query should return default value", () => {
    setCurrencyList([])
    setPriceConversion({ displayCurrency: "USD" })

    const { result } = renderHook(() => useDisplayCurrency())

    expect(result.current).toMatchObject({
      fractionDigits: 2,
      fiatSymbol: "$",
      displayCurrency: "USD",
    })
  })

  it("authed should return NGN from mock", () => {
    setCurrencyList([{ id: "NGN", symbol: "₦", fractionDigits: 2 }])
    mockToDisplayMoneyAmount.mockImplementation((amount: number) => ({
      amount,
      currency: DisplayCurrency,
      currencyCode: "NGN",
    }))
    setPriceConversion({ displayCurrency: "NGN" })

    const { result } = renderHook(() => useDisplayCurrency())

    expect(result.current).toMatchObject({
      fractionDigits: 2,
      fiatSymbol: "₦",
      displayCurrency: "NGN",
    })
  })

  describe("formatMoneyAmount", () => {
    it("should format BTC amount with sats suffix", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toBtcMoneyAmount(1000),
      })

      expect(formatted).toBe("1,000 SAT")
    })

    it("should format USD amount with symbol and decimals", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toUsdMoneyAmount(50000),
      })

      expect(formatted).toBe("$500.00")
    })

    it("should format display currency amount with symbol", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "USD" },
      })

      expect(formatted).toBe("$100.00")
    })

    it("should return empty string for NaN amount", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toBtcMoneyAmount(NaN),
      })

      expect(formatted).toBe("")
    })

    it("should format without symbol when noSymbol is true", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toUsdMoneyAmount(10000),
        noSymbol: true,
      })

      expect(formatted).toBe("100.00")
    })

    it("should format without suffix for BTC when noSuffix is true", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toBtcMoneyAmount(500),
        noSuffix: true,
      })

      expect(formatted).toBe("500")
    })

    it("should add approximate prefix when isApproximate is true", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toUsdMoneyAmount(10000),
        isApproximate: true,
      })

      expect(formatted).toContain("~")
    })

    it("should return currency sync issue message when currency code mismatch", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "EUR" },
      })

      expect(formatted).toBe("Currency sync issue")
    })

    it("should format negative amounts with minus sign", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatMoneyAmount({
        moneyAmount: toUsdMoneyAmount(-10000),
      })

      expect(formatted).toBe("-$100.00")
    })
  })

  describe("formatCurrency", () => {
    it("should format currency with symbol from currency list", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatCurrency({
        amountInMajorUnits: 100,
        currency: "EUR",
      })

      expect(formatted).toBe("€100.00")
    })

    it("should use currency code as symbol for unknown currency", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatCurrency({
        amountInMajorUnits: 50,
        currency: "GBP",
      })

      expect(formatted).toBe("GBP50.00")
    })

    it("should format without sign when withSign is false", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatCurrency({
        amountInMajorUnits: -100,
        currency: "USD",
        withSign: false,
      })

      expect(formatted).toBe("$100.00")
    })

    it("should append currency code when provided", () => {
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
      const { result } = renderHook(() => useDisplayCurrency())

      const symbol = result.current.getCurrencySymbol({ currency: "EUR" })

      expect(symbol).toBe("€")
    })

    it("should return currency code as symbol for unknown currency", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const symbol = result.current.getCurrencySymbol({ currency: "JPY" })

      expect(symbol).toBe("JPY")
    })
  })

  describe("getSecondaryAmountIfCurrencyIsDifferent", () => {
    it("should return undefined when wallet currency matches display currency", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const secondaryAmount = result.current.getSecondaryAmountIfCurrencyIsDifferent({
        primaryAmount: toUsdMoneyAmount(10000),
        displayAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "USD" },
        walletAmount: toUsdMoneyAmount(10000),
      })

      expect(secondaryAmount).toBeUndefined()
    })

    it("should return wallet amount when primary is display currency", () => {
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
      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.formatDisplayAndWalletAmount({
        primaryAmount: toUsdMoneyAmount(10000),
        displayAmount: { amount: 10000, currency: DisplayCurrency, currencyCode: "USD" },
        walletAmount: toUsdMoneyAmount(10000),
      })

      expect(formatted).not.toContain("(")
    })

    it("should use display amount as primary when primary is not provided", () => {
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
      setPriceConversion({ displayCurrency: "USD" })

      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.moneyAmountToDisplayCurrencyString({
        moneyAmount: toBtcMoneyAmount(1000),
      })

      expect(formatted).toBeUndefined()
    })

    it("should convert and format money amount to display currency", () => {
      mockConvertMoneyAmount.mockImplementation(() => ({
        amount: 10000,
        currency: DisplayCurrency,
        currencyCode: "USD",
      }))
      setPriceConversion({
        displayCurrency: "USD",
        convertMoneyAmount: mockConvertMoneyAmount,
      })

      const { result } = renderHook(() => useDisplayCurrency())

      const formatted = result.current.moneyAmountToDisplayCurrencyString({
        moneyAmount: toBtcMoneyAmount(1000),
      })

      expect(formatted).toBe("$100")
    })

    it("should include approximate prefix when isApproximate is true", () => {
      mockConvertMoneyAmount.mockImplementation(() => ({
        amount: 10000,
        currency: DisplayCurrency,
        currencyCode: "USD",
      }))
      setPriceConversion({
        displayCurrency: "USD",
        convertMoneyAmount: mockConvertMoneyAmount,
      })

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
      const { result } = renderHook(() => useDisplayCurrency())

      expect(result.current.currencyInfo[WalletCurrency.Usd]).toEqual({
        symbol: "$",
        minorUnitToMajorUnitOffset: 2,
        showFractionDigits: true,
        currencyCode: "USD",
      })
    })

    it("should return correct info for BTC", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      expect(result.current.currencyInfo[WalletCurrency.Btc]).toEqual({
        symbol: "",
        minorUnitToMajorUnitOffset: 0,
        showFractionDigits: false,
        currencyCode: "SAT",
      })
    })

    it("should return correct info for display currency", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      const info = result.current.currencyInfo[DisplayCurrency]

      expect(info.symbol).toBe("$")
      expect(info.minorUnitToMajorUnitOffset).toBe(2)
      expect(info.currencyCode).toBe("USD")
    })
  })

  describe("properties", () => {
    it("should return correct fraction digits", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      expect(result.current.fractionDigits).toBe(2)
    })

    it("should return correct fiat symbol", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      expect(result.current.fiatSymbol).toBe("$")
    })

    it("should return correct display currency", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      expect(result.current.displayCurrency).toBe("USD")
    })

    it("should return zero display amount", () => {
      const { result } = renderHook(() => useDisplayCurrency())

      expect(result.current.zeroDisplayAmount).toEqual({
        amount: 0,
        currency: DisplayCurrency,
        currencyCode: "USD",
      })
    })
  })
})
