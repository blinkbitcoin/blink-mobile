import React from "react"
import { Linking } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { JoinCommunitySetting } from "@app/screens/settings-screen/settings/community-join"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      support: {
        joinTheCommunity: () => "Join the community",
      },
    },
  }),
}))

const renderRow = () =>
  render(
    <ThemeProvider theme={theme}>
      <JoinCommunitySetting />
    </ThemeProvider>,
  )

describe("JoinCommunitySetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Linking, "openURL").mockResolvedValue(true)
  })

  it("opens the Telegram community directly on tap", () => {
    const { getByText } = renderRow()

    fireEvent.press(getByText("Join the community"))

    expect(Linking.openURL).toHaveBeenCalledTimes(1)
    expect(Linking.openURL).toHaveBeenCalledWith("https://t.me/blinkbtc")
  })
})
