import React from "react"
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
})
