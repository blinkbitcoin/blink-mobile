import * as React from "react"
import { Text as ReactNativeText } from "react-native"
import { render } from "@testing-library/react-native"

import { VersionComponent } from "@app/components/version"

const mockUsePhoneCountryCode = jest.fn()
const mockUseIpCountryCode = jest.fn()

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  usePhoneCountryCode: () => mockUsePhoneCountryCode(),
  useIpCountryCode: () => mockUseIpCountryCode(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        registered: () => "Registered",
        detected: () => "Detected",
        unknown: () => "Unknown",
      },
      GetStartedScreen: {
        headline: () => "Bitcoin is money",
      },
    },
  }),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}))

jest.mock("react-native-device-info", () => ({
  __esModule: true,
  default: { getReadableVersion: () => "2.4.60" },
}))

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  makeStyles: () => () => ({ version: {} }),
}))

describe("VersionComponent", () => {
  beforeEach(() => {
    mockUsePhoneCountryCode.mockReset()
    mockUseIpCountryCode.mockReset()
  })

  it("shows the registered and detected countries below the version", () => {
    mockUsePhoneCountryCode.mockReturnValue("US")
    mockUseIpCountryCode.mockReturnValue("SE")

    const { getByText } = render(<VersionComponent />)

    expect(getByText(/Registered: US · Detected: SE/)).toBeTruthy()
  })

  it("shows unknown as registered country when there is no phone-derived country", () => {
    mockUsePhoneCountryCode.mockReturnValue(undefined)
    mockUseIpCountryCode.mockReturnValue("SE")

    const { getByText } = render(<VersionComponent />)

    expect(getByText(/Registered: Unknown · Detected: SE/)).toBeTruthy()
  })

  it("shows unknown as detected country when the ip lookup fails", () => {
    mockUsePhoneCountryCode.mockReturnValue("US")
    mockUseIpCountryCode.mockReturnValue(undefined)

    const { getByText } = render(<VersionComponent />)

    expect(getByText(/Registered: US · Detected: Unknown/)).toBeTruthy()
  })
})
