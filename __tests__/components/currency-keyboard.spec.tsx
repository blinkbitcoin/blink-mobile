import React from "react"
import { Text as ReactNativeText } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { CurrencyKeyboard } from "@app/components/currency-keyboard/currency-keyboard"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  useTheme: () => ({
    theme: {
      colors: {
        grey2: "grey2",
        grey4: "grey4",
      },
    },
  }),
  makeStyles: () => () => ({
    keyRow: {},
    lastKeyRow: {},
    keyText: {},
    pressedOpacity: {},
  }),
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

  it("renders backspace key", () => {
    const { getByText } = render(<CurrencyKeyboard onPress={mockOnPress} />)

    expect(getByText("⌫")).toBeTruthy()
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
    const { getByText } = render(<CurrencyKeyboard onPress={mockOnPress} />)

    fireEvent.press(getByText("⌫"))

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
})
