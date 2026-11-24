import React from "react"
import { StyleSheet } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { headerCloseControlOptions } from "@app/components/header-close-control"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const renderCloseControl = (params?: Parameters<typeof headerCloseControlOptions>[0]) => {
  const { headerRight } = headerCloseControlOptions(params)
  if (typeof headerRight !== "function") {
    throw new Error("headerRight must be a render function")
  }
  return render(
    <ThemeProvider theme={theme}>{headerRight({ canGoBack: true })}</ThemeProvider>,
  )
}

describe("headerCloseControlOptions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns to the home tab by default", () => {
    const { getByTestId } = renderCloseControl()

    fireEvent.press(getByTestId("icon-close"))

    expect(mockNavigate).toHaveBeenCalledWith("Primary")
  })

  it("navigates to the route it is given", () => {
    const { getByTestId } = renderCloseControl({ navigateTo: "settings" })

    fireEvent.press(getByTestId("icon-close"))

    expect(mockNavigate).toHaveBeenCalledWith("settings")
  })

  /** The native header item is sized to the button's margin box, and a touch outside it
   *  never reaches the button, so the whole 48dp box has to be footprint. The header
   *  insets its right item by 16, so 4 of padding on the right puts the circle 20dp from
   *  the edge and the left takes the rest of the box. */
  it("gives the close a 48dp box with no negative margin, its circle 20dp from the edge", () => {
    const { getByTestId } = renderCloseControl()

    const style = StyleSheet.flatten(getByTestId("close").props.style)
    expect(style).toMatchObject({
      width: 48,
      height: 48,
      paddingTop: 7,
      paddingBottom: 7,
      paddingRight: 4,
      paddingLeft: 10,
    })
    const margins = [
      style.marginTop,
      style.marginBottom,
      style.marginLeft,
      style.marginRight,
    ]
    expect(margins.filter((margin) => typeof margin === "number" && margin < 0)).toEqual(
      [],
    )
  })
})
