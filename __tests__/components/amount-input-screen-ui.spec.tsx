import React from "react"
import { Text as ReactNativeText } from "react-native"
import { render } from "@testing-library/react-native"

import { AmountInputScreenUI } from "@app/components/transfer-amount-input/amount-input-screen-ui"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  makeStyles: () => () => ({
    amountInputScreenContainer: {},
    infoContainer: {},
    bodyContainer: {},
    keyboardContainer: {},
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

describe("AmountInputScreenUI", () => {
  const mockOnKeyPress = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders without error message", () => {
    const { queryByTestId } = render(<AmountInputScreenUI onKeyPress={mockOnKeyPress} />)

    expect(queryByTestId("error-box")).toBeNull()
    expect(queryByTestId("currency-keyboard")).toBeTruthy()
  })

  it("renders with error message", () => {
    const errorMessage = "Invalid amount"
    const { getByTestId, getByText } = render(
      <AmountInputScreenUI errorMessage={errorMessage} onKeyPress={mockOnKeyPress} />,
    )

    expect(getByTestId("error-box")).toBeTruthy()
    expect(getByText(errorMessage)).toBeTruthy()
  })

  it("renders CurrencyKeyboard", () => {
    const { getByTestId } = render(<AmountInputScreenUI onKeyPress={mockOnKeyPress} />)

    expect(getByTestId("currency-keyboard")).toBeTruthy()
  })
})
