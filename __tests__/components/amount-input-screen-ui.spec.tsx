import React from "react"
import { Text as ReactNativeText } from "react-native"
import { render } from "@testing-library/react-native"

import { AmountInputScreenUI } from "@app/components/transfer-amount-input/amount-input-screen-ui"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  makeStyles: () => () => ({
    container: {},
    errorRow: {},
    keyboardContainer: {},
  }),
  useTheme: () => ({
    theme: { colors: { error: "red" } },
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => {
    const ReactNative = jest.requireActual("react-native")
    return <ReactNative.View testID="galoy-icon" />
  },
}))

jest.mock("@app/components/currency-keyboard", () => ({
  CurrencyKeyboard: () => {
    const ReactNative = jest.requireActual("react-native")
    return <ReactNative.View testID="currency-keyboard" />
  },
}))

describe("AmountInputScreenUI", () => {
  const mockOnKeyPress = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders without error message", () => {
    const { queryByText, getByTestId } = render(
      <AmountInputScreenUI onKeyPress={mockOnKeyPress} />,
    )

    expect(queryByText(/invalid/i)).toBeNull()
    expect(getByTestId("currency-keyboard")).toBeTruthy()
  })

  it("renders with error message", () => {
    const errorMessage = "Invalid amount"
    const { getByText } = render(
      <AmountInputScreenUI errorMessage={errorMessage} onKeyPress={mockOnKeyPress} />,
    )

    expect(getByText(errorMessage)).toBeTruthy()
  })

  it("renders CurrencyKeyboard", () => {
    const { getByTestId } = render(<AmountInputScreenUI onKeyPress={mockOnKeyPress} />)

    expect(getByTestId("currency-keyboard")).toBeTruthy()
  })
})
