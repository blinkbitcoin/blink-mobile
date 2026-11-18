import React from "react"
import { StyleSheet, Text } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { CheckboxRow } from "@app/components/card-screen/checkbox-row"
import theme from "@app/rne-theme/theme"
import { light } from "@app/rne-theme/colors"

const renderRow = (checked: boolean, onPress = jest.fn()) =>
  render(
    <ThemeProvider theme={theme}>
      <CheckboxRow checked={checked} onPress={onPress}>
        <Text>I agree</Text>
      </CheckboxRow>
    </ThemeProvider>,
  )

describe("CheckboxRow", () => {
  it("shows its text and toggles on press", () => {
    const onPress = jest.fn()
    const { getByText, getByTestId } = renderRow(false, onPress)

    fireEvent.press(getByTestId("RNE__CheckBox__Wrapper"))

    expect(getByText("I agree")).toBeTruthy()
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("draws an unchecked box in the disabled text color, as the design does", () => {
    const { getByTestId } = renderRow(false)

    const iconStyle = StyleSheet.flatten(getByTestId("RNE__Checkbox__Icon").props.style)
    expect(iconStyle.color).toBe(light.textDisabled)
  })

  it("draws the box straight on the screen, with no background behind it", () => {
    const { getByTestId } = renderRow(false)

    const wrapperStyle = StyleSheet.flatten(
      getByTestId("RNE__CheckBox__Wrapper").props.style,
    )
    expect(wrapperStyle.backgroundColor).toBe("transparent")
  })
})
