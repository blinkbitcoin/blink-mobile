import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ThemeProvider } from "@rn-vui/themed"

const mockGoBack = jest.fn()

let mockRouteParams: { reason?: string } | undefined
let mockNonCustodialEnabled = true

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({ nonCustodialEnabled: mockNonCustodialEnabled }),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
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
  beforeEach(() => {
    jest.clearAllMocks()
    mockRouteParams = undefined
    mockNonCustodialEnabled = true
  })

  it("renders the title and description", () => {
    const { getByText } = render(wrap(<UnsupportedRegionScreen />))

    expect(getByText("Unsupported region")).toBeTruthy()
    expect(
      getByText("Unfortunately we can not serve users from your current region."),
    ).toBeTruthy()
  })

  it("keeps the regional wording for a refusal that names no reason", () => {
    mockRouteParams = undefined
    const { getByText } = render(wrap(<UnsupportedRegionScreen />))

    expect(
      getByText("Unfortunately we can not serve users from your current region."),
    ).toBeTruthy()
  })

  it("titles the unreadable location rather than calling the region unsupported", () => {
    mockRouteParams = { reason: "unknownRegion" }
    const { getByText, queryByText } = render(wrap(<UnsupportedRegionScreen />))

    expect(getByText("Region not determined")).toBeTruthy()
    expect(queryByText("Unsupported region")).toBeNull()
  })

  it("ignores a reason that only exists on Object's prototype", () => {
    // `in` would accept these and call them as if they described a refusal.
    mockRouteParams = { reason: "valueOf" }
    const { getByText } = render(wrap(<UnsupportedRegionScreen />))

    expect(getByText("Unsupported region")).toBeTruthy()
    expect(
      getByText("Unfortunately we can not serve users from your current region."),
    ).toBeTruthy()
  })

  it("falls back to the regional wording for a reason it does not know", () => {
    // A deep link from an older build could still name a refusal this one dropped.
    mockRouteParams = { reason: "somethingThisBuildDroppedLongAgo" }
    const { getByText } = render(wrap(<UnsupportedRegionScreen />))

    expect(getByText("Unsupported region")).toBeTruthy()
    expect(
      getByText("Unfortunately we can not serve users from your current region."),
    ).toBeTruthy()
  })

  it("offers self-custodial when only the first Blink account was refused", () => {
    mockRouteParams = { reason: "firstCustodialSignup" }
    const { getByText } = render(wrap(<UnsupportedRegionScreen />))

    // Saying we cannot serve the region at all would send away a user who still has an option.
    expect(
      getByText(
        "Unfortunately we can not create new custodial accounts in your current region. You can use a self-custodial account instead.",
      ),
    ).toBeTruthy()
  })

  it("withholds the self-custodial offer when that option is turned off", () => {
    mockRouteParams = { reason: "firstCustodialSignup" }
    mockNonCustodialEnabled = false
    const { getByText } = render(wrap(<UnsupportedRegionScreen />))

    // Pointing at an option this build does not offer would be a dead end.
    expect(
      getByText(
        "Unfortunately we can not create new custodial accounts in your current region.",
      ),
    ).toBeTruthy()
  })

  it("says the location was unreadable rather than blaming the region", () => {
    mockRouteParams = { reason: "unknownRegion" }
    const { getByText } = render(wrap(<UnsupportedRegionScreen />))

    expect(
      getByText(
        "We could not determine your region. Please check your connection and try again.",
      ),
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
