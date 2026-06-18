import React from "react"
import { render } from "@testing-library/react-native"

import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import {
  AmountInputScreen,
  ConvertInputType,
} from "@app/components/transfer-amount-input/amount-input-screen"

const mockConvertMoneyAmount = jest.fn()
const mockFormatMoneyAmount = jest.fn()
const mockOnAmountChange = jest.fn()
const mockOnSetFormattedAmount = jest.fn()

const CHIP_AMOUNT_SATS = 25000

jest.mock("@app/hooks/use-display-currency", () => {
  const currencyInfo = {
    BTC: {
      symbol: "",
      minorUnitToMajorUnitOffset: 0,
      showFractionDigits: false,
      currencyCode: "SAT",
    },
    USD: {
      symbol: "$",
      minorUnitToMajorUnitOffset: 2,
      showFractionDigits: true,
      currencyCode: "USD",
    },
    DisplayCurrency: {
      symbol: "$",
      minorUnitToMajorUnitOffset: 2,
      showFractionDigits: true,
      currencyCode: "USD",
    },
  }
  const zeroDisplayAmount = {
    amount: 0,
    currency: "DisplayCurrency",
    currencyCode: "USD",
  }
  return {
    useDisplayCurrency: () => ({
      currencyInfo,
      formatMoneyAmount: mockFormatMoneyAmount,
      zeroDisplayAmount,
    }),
  }
})

jest.mock("@app/hooks/use-debounce", () => ({
  useDebouncedEffect: (callback: () => void) => {
    React.useEffect(() => {
      callback()
    }, [callback])
  },
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AmountInputScreen: {
        maxAmountExceeded: ({ maxAmount }: { maxAmount: string }) =>
          `Maximum amount exceeded: ${maxAmount}`,
        minAmountNotMet: ({ minAmount }: { minAmount: string }) =>
          `Minimum amount not met: ${minAmount}`,
      },
    },
  }),
}))

jest.mock("@app/components/transfer-amount-input/amount-input-screen-ui", () => ({
  AmountInputScreenUI: ({ errorMessage }: { errorMessage: string }) => {
    const ReactNative = jest.requireActual("react-native")
    return (
      <ReactNative.View testID="amount-input-screen-ui">
        <ReactNative.Text testID="error-message">{errorMessage}</ReactNative.Text>
      </ReactNative.View>
    )
  },
}))

describe("AmountInputScreen", () => {
  const defaultInputValues = {
    formattedAmount: "",
    fromInput: {
      id: ConvertInputType.FROM,
      currency: "BTC" as const,
      formattedAmount: "",
      isFocused: false,
      amount: toBtcMoneyAmount(0),
    },
    toInput: {
      id: ConvertInputType.TO,
      currency: "USD" as const,
      formattedAmount: "",
      isFocused: false,
      amount: toUsdMoneyAmount(0),
    },
    currencyInput: {
      id: ConvertInputType.CURRENCY,
      currency: "DisplayCurrency" as const,
      formattedAmount: "",
      isFocused: false,
      amount: { amount: 0, currency: "DisplayCurrency" as const, currencyCode: "USD" },
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockConvertMoneyAmount.mockImplementation((amount) => amount)
    mockFormatMoneyAmount.mockReturnValue("$0.00")
  })

  it("renders AmountInputScreenUI", () => {
    const { getByTestId } = render(
      <AmountInputScreen
        inputValues={defaultInputValues}
        onAmountChange={mockOnAmountChange}
        convertMoneyAmount={mockConvertMoneyAmount}
        onSetFormattedAmount={mockOnSetFormattedAmount}
        focusedInput={null}
      />,
    )

    expect(getByTestId("amount-input-screen-ui")).toBeTruthy()
  })

  it("renders without error message when no validation errors", () => {
    const { getByTestId } = render(
      <AmountInputScreen
        inputValues={defaultInputValues}
        onAmountChange={mockOnAmountChange}
        convertMoneyAmount={mockConvertMoneyAmount}
        onSetFormattedAmount={mockOnSetFormattedAmount}
        focusedInput={null}
      />,
    )

    const errorElement = getByTestId("error-message")
    expect(errorElement.props.children).toBe("")
  })

  it("propagates a fresh initialAmount even when focusedInput identity changes in the same render", () => {
    const initialFocusedInput = {
      id: ConvertInputType.FROM,
      currency: "BTC" as const,
      formattedAmount: "",
      isFocused: true,
      amount: toBtcMoneyAmount(0),
    }

    const { rerender } = render(
      <AmountInputScreen
        inputValues={defaultInputValues}
        onAmountChange={mockOnAmountChange}
        convertMoneyAmount={mockConvertMoneyAmount}
        onSetFormattedAmount={mockOnSetFormattedAmount}
        focusedInput={initialFocusedInput}
      />,
    )

    mockOnAmountChange.mockClear()

    const chipAmount = toBtcMoneyAmount(CHIP_AMOUNT_SATS)
    const refocusedInput = {
      ...initialFocusedInput,
      amount: {
        ...initialFocusedInput.amount,
        currency: "USD" as const,
        currencyCode: "USD",
      },
    }

    rerender(
      <AmountInputScreen
        inputValues={defaultInputValues}
        onAmountChange={mockOnAmountChange}
        convertMoneyAmount={mockConvertMoneyAmount}
        onSetFormattedAmount={mockOnSetFormattedAmount}
        focusedInput={refocusedInput}
        initialAmount={chipAmount}
      />,
    )

    expect(mockOnAmountChange).toHaveBeenCalledWith(
      expect.objectContaining({ amount: CHIP_AMOUNT_SATS }),
    )
    expect(mockOnAmountChange.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ amount: CHIP_AMOUNT_SATS }),
    )
  })
})
