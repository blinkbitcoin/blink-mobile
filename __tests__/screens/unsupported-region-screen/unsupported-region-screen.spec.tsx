import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ThemeProvider } from "@rn-vui/themed"

const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}))

jest.mock("@app/components/screen", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    Screen: ({ children }: { children: React.ReactNode }) =>
      ReactNs.createElement(RN.View, null, children),
  }
})

import { UnsupportedRegionScreen } from "@app/screens/unsupported-region-screen"

loadLocale("en")

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

describe("UnsupportedRegionScreen", () => {
  beforeEach(() => jest.clearAllMocks())

  it("renders the title and description", () => {
    const { getByText } = render(wrap(<UnsupportedRegionScreen />))

    expect(getByText("Unsupported region")).toBeTruthy()
    expect(
      getByText("Unfortunately we can not serve users from your current region."),
    ).toBeTruthy()
  })

  it("renders the close icon hero", () => {
    const { getByTestId } = render(wrap(<UnsupportedRegionScreen />))

    expect(getByTestId("icon-close")).toBeTruthy()
  })

  it("dismisses the screen when the Close button is pressed", () => {
    const { getByText } = render(wrap(<UnsupportedRegionScreen />))

    fireEvent.press(getByText("Close"))

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })
})
