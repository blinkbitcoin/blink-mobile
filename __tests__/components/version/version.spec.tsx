import * as React from "react"
import { Text as ReactNativeText } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

import { VersionComponent } from "@app/components/version"

const mockUsePhoneCountryCode = jest.fn()
const mockUseIpCountryCode = jest.fn()

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  usePhoneCountryCode: () => mockUsePhoneCountryCode(),
  useIpCountryCode: (enabled: boolean) => mockUseIpCountryCode(enabled),
}))

let mockIsAnonMode = false
jest.mock("@app/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        country: () => "Country",
        registered: () => "Registered",
        detected: () => "Detected",
        unknown: () => "Unknown",
      },
      GetStartedScreen: {
        headline: () => "Wallet powered by Blink",
      },
    },
  }),
}))

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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
    mockNavigate.mockClear()
    mockIsAnonMode = false
  })

  it("shows the registered and detected countries below the version", () => {
    mockUsePhoneCountryCode.mockReturnValue("US")
    mockUseIpCountryCode.mockReturnValue("SE")

    const { getByText } = render(<VersionComponent />)

    expect(getByText(/Registered: US · Detected: SE/)).toBeTruthy()
  })

  it("shows the headline below the countries", () => {
    mockUsePhoneCountryCode.mockReturnValue("US")
    mockUseIpCountryCode.mockReturnValue("SE")

    const { getByText } = render(<VersionComponent />)

    expect(getByText(/Wallet powered by Blink/)).toBeTruthy()
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

  it("enables the ip lookup outside Anon mode", () => {
    mockUsePhoneCountryCode.mockReturnValue("US")
    mockUseIpCountryCode.mockReturnValue("SE")

    render(<VersionComponent />)

    expect(mockUseIpCountryCode).toHaveBeenCalledWith(true)
  })

  it("opens the developer screen after three taps on the version text", () => {
    mockUsePhoneCountryCode.mockReturnValue("US")
    mockUseIpCountryCode.mockReturnValue("SE")

    const { getByText } = render(<VersionComponent />)

    fireEvent.press(getByText(/2\.4\.60/))
    fireEvent.press(getByText(/2\.4\.60/))
    fireEvent.press(getByText(/2\.4\.60/))

    expect(mockNavigate).toHaveBeenCalledWith("developerScreen")
  })

  it("states no country in Anon mode", () => {
    mockIsAnonMode = true
    mockUsePhoneCountryCode.mockReturnValue(undefined)
    mockUseIpCountryCode.mockReturnValue(undefined)

    const { getByText, queryByText } = render(<VersionComponent />)

    expect(getByText(/Country: Unknown/)).toBeTruthy()
    expect(queryByText(/Registered:/)).toBeNull()
    expect(queryByText(/Detected:/)).toBeNull()
  })
})
