import React from "react"
import { Text as ReactNativeText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { CurrencyKeyboard } from "@app/components/currency-keyboard/currency-keyboard"
import {
  getDisabledKeys,
  Key,
  NumberPadReducerState,
} from "@app/components/amount-input-screen/number-pad-reducer"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  makeStyles: () => () => ({
    keyboard: {},
    keyRow: {},
    key: {},
    keyDisabled: {},
    keyPressedBg: {},
    keyText: {},
    backspaceIcon: { color: "primary" },
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, ...props }: { name: string }) => (
    <View {...props} testID={`galoy-icon-${name}`} />
  ),
}))

describe("CurrencyKeyboard", () => {
  const mockOnPress = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders all numeric keys from 0 to 9", () => {
    const { getByText } = render(<CurrencyKeyboard onPress={mockOnPress} />)

    expect(getByText("0")).toBeTruthy()
    expect(getByText("1")).toBeTruthy()
    expect(getByText("2")).toBeTruthy()
    expect(getByText("3")).toBeTruthy()
    expect(getByText("4")).toBeTruthy()
    expect(getByText("5")).toBeTruthy()
    expect(getByText("6")).toBeTruthy()
    expect(getByText("7")).toBeTruthy()
    expect(getByText("8")).toBeTruthy()
    expect(getByText("9")).toBeTruthy()
  })

  it("renders decimal key", () => {
    const { getByText } = render(<CurrencyKeyboard onPress={mockOnPress} />)

    expect(getByText(".")).toBeTruthy()
  })

  it("renders backspace icon", () => {
    const { getByTestId } = render(<CurrencyKeyboard onPress={mockOnPress} />)

    expect(getByTestId("galoy-icon-back-space")).toBeTruthy()
  })

  it("calls onPress when numeric key is pressed", () => {
    const { getByText } = render(<CurrencyKeyboard onPress={mockOnPress} />)

    fireEvent.press(getByText("5"))

    expect(mockOnPress).toHaveBeenCalledWith("5")
    expect(mockOnPress).toHaveBeenCalledTimes(1)
  })

  it("calls onPress when decimal key is pressed", () => {
    const { getByText } = render(<CurrencyKeyboard onPress={mockOnPress} />)

    fireEvent.press(getByText("."))

    expect(mockOnPress).toHaveBeenCalledWith(".")
    expect(mockOnPress).toHaveBeenCalledTimes(1)
  })

  it("calls onPress when backspace key is pressed", () => {
    const { getByTestId } = render(<CurrencyKeyboard onPress={mockOnPress} />)

    fireEvent.press(getByTestId("Key ⌫"))

    expect(mockOnPress).toHaveBeenCalledWith("⌫")
    expect(mockOnPress).toHaveBeenCalledTimes(1)
  })

  it("calls onPress multiple times when different keys are pressed", () => {
    const { getByText } = render(<CurrencyKeyboard onPress={mockOnPress} />)

    fireEvent.press(getByText("1"))
    fireEvent.press(getByText("2"))
    fireEvent.press(getByText("3"))

    expect(mockOnPress).toHaveBeenCalledTimes(3)
    expect(mockOnPress).toHaveBeenNthCalledWith(1, "1")
    expect(mockOnPress).toHaveBeenNthCalledWith(2, "2")
    expect(mockOnPress).toHaveBeenNthCalledWith(3, "3")
  })

  it("does not call onPress for disabled keys", () => {
    const disabled = new Set([Key.Decimal, Key.Backspace])
    const { getByText, getByTestId } = render(
      <CurrencyKeyboard onPress={mockOnPress} disabledKeys={disabled} />,
    )

    fireEvent.press(getByText("."))
    fireEvent.press(getByTestId("Key ⌫"))

    expect(mockOnPress).not.toHaveBeenCalled()
  })

  it("still calls onPress for enabled keys when some keys are disabled", () => {
    const disabled = new Set([Key.Decimal])
    const { getByText } = render(
      <CurrencyKeyboard onPress={mockOnPress} disabledKeys={disabled} />,
    )

    fireEvent.press(getByText("5"))

    expect(mockOnPress).toHaveBeenCalledWith("5")
  })
})

describe("getDisabledKeys", () => {
  const makeState = (overrides: {
    currency?: string
    numberOfDecimalsAllowed?: number
    majorAmount?: string
    minorAmount?: string
    hasDecimal?: boolean
  }): NumberPadReducerState => ({
    currency: (overrides.currency ?? "BTC") as NumberPadReducerState["currency"],
    numberOfDecimalsAllowed: overrides.numberOfDecimalsAllowed ?? 0,
    numberPadNumber: {
      majorAmount: overrides.majorAmount ?? "",
      minorAmount: overrides.minorAmount ?? "",
      hasDecimal: overrides.hasDecimal ?? false,
    },
  })

  describe("BTC wallet (no decimals)", () => {
    it("disables backspace and decimal when there is no amount", () => {
      const disabled = getDisabledKeys(makeState({ currency: "BTC" }))

      expect(disabled.has(Key.Backspace)).toBe(true)
      expect(disabled.has(Key.Decimal)).toBe(true)
    })

    it("enables backspace when there is an amount", () => {
      const disabled = getDisabledKeys(makeState({ currency: "BTC", majorAmount: "100" }))

      expect(disabled.has(Key.Backspace)).toBe(false)
    })

    it("keeps decimal disabled even with an amount", () => {
      const disabled = getDisabledKeys(makeState({ currency: "BTC", majorAmount: "999" }))

      expect(disabled.has(Key.Decimal)).toBe(true)
    })

    it("never disables number keys", () => {
      const disabled = getDisabledKeys(makeState({ currency: "BTC" }))

      expect(disabled.has(Key[0])).toBe(false)
      expect(disabled.has(Key[1])).toBe(false)
      expect(disabled.has(Key[5])).toBe(false)
      expect(disabled.has(Key[9])).toBe(false)
    })
  })

  describe("USD wallet (2 decimals)", () => {
    it("disables backspace when there is no amount", () => {
      const disabled = getDisabledKeys(
        makeState({ currency: "USD", numberOfDecimalsAllowed: 2 }),
      )

      expect(disabled.has(Key.Backspace)).toBe(true)
    })

    it("enables decimal when there is no amount", () => {
      const disabled = getDisabledKeys(
        makeState({ currency: "USD", numberOfDecimalsAllowed: 2 }),
      )

      expect(disabled.has(Key.Decimal)).toBe(false)
    })

    it("enables both backspace and decimal when there is an amount without decimal", () => {
      const disabled = getDisabledKeys(
        makeState({ currency: "USD", numberOfDecimalsAllowed: 2, majorAmount: "5" }),
      )

      expect(disabled.has(Key.Backspace)).toBe(false)
      expect(disabled.has(Key.Decimal)).toBe(false)
    })

    it("disables decimal when decimal is already in use", () => {
      const disabled = getDisabledKeys(
        makeState({
          currency: "USD",
          numberOfDecimalsAllowed: 2,
          majorAmount: "5",
          hasDecimal: true,
        }),
      )

      expect(disabled.has(Key.Decimal)).toBe(true)
      expect(disabled.has(Key.Backspace)).toBe(false)
    })

    it("disables decimal when minor amount is filled", () => {
      const disabled = getDisabledKeys(
        makeState({
          currency: "USD",
          numberOfDecimalsAllowed: 2,
          majorAmount: "10",
          minorAmount: "50",
          hasDecimal: true,
        }),
      )

      expect(disabled.has(Key.Decimal)).toBe(true)
      expect(disabled.has(Key.Backspace)).toBe(false)
    })

    it("never disables number keys", () => {
      const disabled = getDisabledKeys(
        makeState({ currency: "USD", numberOfDecimalsAllowed: 2 }),
      )

      expect(disabled.has(Key[0])).toBe(false)
      expect(disabled.has(Key[3])).toBe(false)
      expect(disabled.has(Key[7])).toBe(false)
    })
  })

  describe("display currency with decimals", () => {
    it("disables backspace when empty and enables decimal", () => {
      const disabled = getDisabledKeys(
        makeState({ currency: "DisplayCurrency", numberOfDecimalsAllowed: 2 }),
      )

      expect(disabled.has(Key.Backspace)).toBe(true)
      expect(disabled.has(Key.Decimal)).toBe(false)
    })

    it("enables backspace when only decimal has been typed", () => {
      const disabled = getDisabledKeys(
        makeState({
          currency: "DisplayCurrency",
          numberOfDecimalsAllowed: 2,
          hasDecimal: true,
        }),
      )

      expect(disabled.has(Key.Backspace)).toBe(false)
    })

    it("disables decimal when already in use", () => {
      const disabled = getDisabledKeys(
        makeState({
          currency: "DisplayCurrency",
          numberOfDecimalsAllowed: 2,
          majorAmount: "0",
          hasDecimal: true,
        }),
      )

      expect(disabled.has(Key.Decimal)).toBe(true)
      expect(disabled.has(Key.Backspace)).toBe(false)
    })
  })
})
