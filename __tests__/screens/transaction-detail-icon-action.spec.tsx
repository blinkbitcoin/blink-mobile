import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"

import { IconAction } from "@app/screens/transaction-detail-screen/transaction-detail-screen"

const renderAction = (onPress: () => void) =>
  render(
    <ThemeProvider theme={theme}>
      <IconAction name="copy-paste" onPress={onPress} />
    </ThemeProvider>,
  )

describe("IconAction", () => {
  // Regression guard for #3732: the copy / open-in-explorer icons in the
  // transaction detail rows must actually fire their handler when tapped.
  // Before the fix the handler was dropped (TouchableWithoutFeedback +
  // GaloyIcon), so pressing did nothing.
  it("calls onPress when the icon is pressed", () => {
    const onPress = jest.fn()
    const { getByTestId } = renderAction(onPress)

    fireEvent.press(getByTestId("copy-paste"))

    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
