import { renderHook } from "@testing-library/react-hooks"

import { useConversionFormatting } from "@app/screens/conversion-flow/hooks/use-conversion-formatting"
import { ConvertInputType } from "@app/components/transfer-amount-input"
import { WalletCurrency } from "@app/graphql/generated"
import { DisplayCurrency } from "@app/types/amounts"

describe("useConversionFormatting", () => {
  const mockGetCurrencySymbol = jest.fn()

  const defaultInputValues = {
    formattedAmount: "",
    fromInput: {
      id: ConvertInputType.FROM,
      currency: WalletCurrency.Btc,
      formattedAmount: "",
      isFocused: false,
      amount: { amount: 0, currency: WalletCurrency.Btc, currencyCode: "SAT" },
    },
    toInput: {
      id: ConvertInputType.TO,
      currency: WalletCurrency.Usd,
      formattedAmount: "",
      isFocused: false,
      amount: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
    },
    currencyInput: {
      id: ConvertInputType.CURRENCY,
      currency: DisplayCurrency,
      formattedAmount: "",
      isFocused: false,
      amount: { amount: 0, currency: DisplayCurrency, currencyCode: "USD" },
    },
  }

  const defaultInputFormattedValues = {
    formattedAmount: "100",
    fromInput: {
      id: ConvertInputType.FROM,
      currency: WalletCurrency.Btc,
      formattedAmount: "1,000 sats",
      isFocused: false,
      amount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "SAT" },
    },
    toInput: {
      id: ConvertInputType.TO,
      currency: WalletCurrency.Usd,
      formattedAmount: "$10.00",
      isFocused: false,
      amount: { amount: 1000, currency: WalletCurrency.Usd, currencyCode: "USD" },
    },
    currencyInput: {
      id: ConvertInputType.CURRENCY,
      currency: DisplayCurrency,
      formattedAmount: "$10.00",
      isFocused: false,
      amount: { amount: 1000, currency: DisplayCurrency, currencyCode: "USD" },
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrencySymbol.mockReturnValue("$")
  })

  it("returns formatted value when not typing", () => {
    const { result } = renderHook(() =>
      useConversionFormatting({
        inputValues: defaultInputValues,
        inputFormattedValues: defaultInputFormattedValues,
        isTyping: false,
        typingInputId: null,
        lockFormattingInputId: null,
        displayCurrency: DisplayCurrency,
        getCurrencySymbol: mockGetCurrencySymbol,
      }),
    )

    expect(result.current.renderValue(ConvertInputType.FROM)).toBe("1,000 sats")
  })

  it("returns typed value when typing for specific input", () => {
    mockGetCurrencySymbol.mockReturnValue("$")
    const { result } = renderHook(() =>
      useConversionFormatting({
        inputValues: defaultInputValues,
        inputFormattedValues: defaultInputFormattedValues,
        isTyping: true,
        typingInputId: ConvertInputType.TO,
        lockFormattingInputId: null,
        displayCurrency: DisplayCurrency,
        getCurrencySymbol: mockGetCurrencySymbol,
      }),
    )

    expect(result.current.renderValue(ConvertInputType.TO)).toBe("$100")
  })

  it("returns BTC value with SAT suffix when typing BTC", () => {
    const { result } = renderHook(() =>
      useConversionFormatting({
        inputValues: defaultInputValues,
        inputFormattedValues: defaultInputFormattedValues,
        isTyping: true,
        typingInputId: ConvertInputType.FROM,
        lockFormattingInputId: null,
        displayCurrency: DisplayCurrency,
        getCurrencySymbol: mockGetCurrencySymbol,
      }),
    )

    expect(result.current.renderValue(ConvertInputType.FROM)).toBe("100 SAT")
  })

  it("returns empty string when no formatted amount", () => {
    const { result } = renderHook(() =>
      useConversionFormatting({
        inputValues: defaultInputValues,
        inputFormattedValues: null,
        isTyping: false,
        typingInputId: null,
        lockFormattingInputId: null,
        displayCurrency: DisplayCurrency,
        getCurrencySymbol: mockGetCurrencySymbol,
      }),
    )

    expect(result.current.renderValue(ConvertInputType.FROM)).toBe("")
  })

  it("returns caret selection at end when no BTC suffix", () => {
    mockGetCurrencySymbol.mockReturnValue("$")
    const { result } = renderHook(() =>
      useConversionFormatting({
        inputValues: defaultInputValues,
        inputFormattedValues: defaultInputFormattedValues,
        isTyping: true,
        typingInputId: ConvertInputType.TO,
        lockFormattingInputId: null,
        displayCurrency: DisplayCurrency,
        getCurrencySymbol: mockGetCurrencySymbol,
      }),
    )

    const selection = result.current.caretSelectionFor(ConvertInputType.TO)
    expect(selection.start).toBe(4)
    expect(selection.end).toBe(4)
  })

  it("returns caret selection before BTC suffix", () => {
    const { result } = renderHook(() =>
      useConversionFormatting({
        inputValues: defaultInputValues,
        inputFormattedValues: defaultInputFormattedValues,
        isTyping: true,
        typingInputId: ConvertInputType.FROM,
        lockFormattingInputId: null,
        displayCurrency: DisplayCurrency,
        getCurrencySymbol: mockGetCurrencySymbol,
      }),
    )

    const selection = result.current.caretSelectionFor(ConvertInputType.FROM)
    expect(selection.start).toBe(3)
    expect(selection.end).toBe(3)
  })

  it("returns typed value when lockFormattingInputId matches", () => {
    const { result } = renderHook(() =>
      useConversionFormatting({
        inputValues: defaultInputValues,
        inputFormattedValues: defaultInputFormattedValues,
        isTyping: false,
        typingInputId: null,
        lockFormattingInputId: ConvertInputType.CURRENCY,
        displayCurrency: DisplayCurrency,
        getCurrencySymbol: mockGetCurrencySymbol,
      }),
    )

    expect(result.current.renderValue(ConvertInputType.CURRENCY)).toBe("$100")
  })
})
