import React from "react"
import { Text as ReactNativeText } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

import {
  AmountInputScreenUI,
  AmountInputScreenUIProps,
} from "@app/components/amount-input-screen/amount-input-screen-ui"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AmountInputScreen: {
        setAmount: () => "Set Amount",
      },
    },
  }),
}))

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  useTheme: () => ({
    theme: {
      colors: {
        primary: "primary",
        grey4: "grey4",
        grey5: "grey5",
        grey6: "grey6",
        black: "black",
        white: "white",
        grey3: "grey3",
      },
    },
  }),
  makeStyles: () => () => ({
    sheet: {},
    currencyInputGroup: {},
    inputRow: {},
    primaryRowBg: {},
    singleRow: {},
    topRow: {},
    bottomRow: {},
    toggleOverlay: {},
    toggleButton: {},
    amountContainer: {},
    amountText: {},
    hiddenInput: {},
    keyboardContainer: {},
    ctaSection: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-error-box", () => ({
  GaloyErrorBox: ({ errorMessage }: { errorMessage: string }) => {
    const ReactNative = jest.requireActual("react-native")
    return (
      <ReactNative.View testID="error-box">
        <ReactNative.Text>{errorMessage}</ReactNative.Text>
      </ReactNative.View>
    )
  },
}))

jest.mock("@app/components/currency-keyboard", () => ({
  CurrencyKeyboard: () => {
    const ReactNative = jest.requireActual("react-native")
    return <ReactNative.View testID="currency-keyboard" />
  },
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({
    title,
    disabled,
    onPress,
  }: {
    title: string
    disabled: boolean
    onPress?: () => void
  }) => {
    const ReactNative = jest.requireActual("react-native")
    return (
      <ReactNative.View testID="set-amount-button" accessibilityState={{ disabled }}>
        <ReactNative.TouchableOpacity onPress={onPress} disabled={disabled}>
          <ReactNative.Text>{title}</ReactNative.Text>
        </ReactNative.TouchableOpacity>
      </ReactNative.View>
    )
  },
}))

jest.mock("@app/components/atomic/currency-pill/currency-pill", () => ({
  CurrencyPill: ({ label }: { label?: string }) => {
    const ReactNative = jest.requireActual("react-native")
    return <ReactNative.Text testID="currency-pill">{label}</ReactNative.Text>
  },
}))

jest.mock("@app/components/atomic/galoy-icon/galoy-icon", () => ({
  GaloyIcon: () => {
    const ReactNative = jest.requireActual("react-native")
    return <ReactNative.View testID="galoy-icon-transfer" />
  },
}))

describe("AmountInputScreenUI", () => {
  const mockOnKeyPress = jest.fn()
  const mockOnPaste = jest.fn()
  const mockOnClearAmount = jest.fn()
  const mockOnToggleCurrency = jest.fn()
  const mockOnSetAmountPress = jest.fn()

  const defaultProps: AmountInputScreenUIProps = {
    primaryCurrencyCode: "USD",
    onKeyPress: mockOnKeyPress,
    onPaste: mockOnPaste,
    onClearAmount: mockOnClearAmount,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders primary currency with symbol and amount", () => {
    const { getByText } = render(
      <AmountInputScreenUI
        {...defaultProps}
        primaryCurrencySymbol="$"
        primaryCurrencyFormattedAmount="42.50"
      />,
    )

    expect(getByText("$42.50")).toBeTruthy()
  })

  it("renders default '0' when no formatted amount", () => {
    const { getByText } = render(<AmountInputScreenUI {...defaultProps} />)

    expect(getByText("0")).toBeTruthy()
  })

  it("renders single row when no secondary currency", () => {
    const { queryByTestId } = render(<AmountInputScreenUI {...defaultProps} />)

    expect(queryByTestId("galoy-icon-transfer")).toBeNull()
  })

  it("renders dual rows when secondary exists", () => {
    const { getByTestId } = render(
      <AmountInputScreenUI
        {...defaultProps}
        secondaryCurrencyFormattedAmount="1,500"
        secondaryCurrencyCode="SAT"
        secondaryCurrencySymbol=""
        onToggleCurrency={mockOnToggleCurrency}
      />,
    )

    expect(getByTestId("galoy-icon-transfer")).toBeTruthy()
  })

  it("toggle button calls onToggleCurrency on press", () => {
    const { getByTestId } = render(
      <AmountInputScreenUI
        {...defaultProps}
        secondaryCurrencyFormattedAmount="1,500"
        secondaryCurrencyCode="SAT"
        onToggleCurrency={mockOnToggleCurrency}
      />,
    )

    fireEvent.press(getByTestId("galoy-icon-transfer"))
    expect(mockOnToggleCurrency).toHaveBeenCalledTimes(1)
  })

  it("does not render error box when no error message", () => {
    const { queryByTestId } = render(<AmountInputScreenUI {...defaultProps} />)

    expect(queryByTestId("error-box")).toBeNull()
  })

  it("renders error box with message", () => {
    const { getByTestId, getByText } = render(
      <AmountInputScreenUI {...defaultProps} errorMessage="Maximum exceeded" />,
    )

    expect(getByTestId("error-box")).toBeTruthy()
    expect(getByText("Maximum exceeded")).toBeTruthy()
  })

  it("renders CurrencyKeyboard", () => {
    const { getByTestId } = render(<AmountInputScreenUI {...defaultProps} />)

    expect(getByTestId("currency-keyboard")).toBeTruthy()
  })

  it("renders Set Amount button enabled", () => {
    const { getByTestId } = render(
      <AmountInputScreenUI {...defaultProps} onSetAmountPress={mockOnSetAmountPress} />,
    )

    const button = getByTestId("set-amount-button")
    expect(button).toBeTruthy()
    expect(button.props.accessibilityState.disabled).toBeFalsy()
  })

  it("Set Amount button disabled when setAmountDisabled=true", () => {
    const { getByTestId } = render(
      <AmountInputScreenUI
        {...defaultProps}
        onSetAmountPress={mockOnSetAmountPress}
        setAmountDisabled
      />,
    )

    expect(getByTestId("set-amount-button").props.accessibilityState.disabled).toBe(true)
  })

  it("Set Amount button disabled when onSetAmountPress undefined", () => {
    const { getByTestId } = render(<AmountInputScreenUI {...defaultProps} />)

    expect(getByTestId("set-amount-button").props.accessibilityState.disabled).toBe(true)
  })

  it("hidden TextInput paste strips non-numeric and calls onPaste", () => {
    // eslint-disable-next-line camelcase
    const { UNSAFE_getByType } = render(<AmountInputScreenUI {...defaultProps} />)
    const { TextInput } = jest.requireActual("react-native")

    const hiddenInput = UNSAFE_getByType(TextInput)
    fireEvent.changeText(hiddenInput, "abc42.50xyz")

    expect(mockOnPaste).toHaveBeenCalledWith(42.5)
  })

  it("invalid paste with double decimal does NOT call onPaste", () => {
    // eslint-disable-next-line camelcase
    const { UNSAFE_getByType } = render(<AmountInputScreenUI {...defaultProps} />)
    const { TextInput } = jest.requireActual("react-native")

    const hiddenInput = UNSAFE_getByType(TextInput)
    fireEvent.changeText(hiddenInput, "42..50")

    expect(mockOnPaste).not.toHaveBeenCalled()
  })
})
