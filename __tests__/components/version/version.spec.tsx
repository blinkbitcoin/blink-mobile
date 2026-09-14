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
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

let mockActiveAccountType: string | undefined = "custodial"
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: mockActiveAccountType ? { type: mockActiveAccountType } : undefined,
  }),
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
    mockActiveAccountType = "custodial"
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

  describe("developer screen secret trigger", () => {
    const originalDev = __DEV__
    const setDev = (value: boolean) => {
      ;(global as unknown as { __DEV__: boolean }).__DEV__ = value
    }

    beforeEach(() => {
      mockUsePhoneCountryCode.mockReturnValue("US")
      mockUseIpCountryCode.mockReturnValue("SE")
    })

    afterEach(() => {
      setDev(originalDev)
    })

    const tapVersion = (times: number) => {
      const { getByTestId } = render(<VersionComponent />)
      const versionText = getByTestId("Version Build Text")
      for (let i = 0; i < times; i += 1) {
        fireEvent.press(versionText)
      }
    }

    it("navigates to the developer screen after three taps in development builds", () => {
      setDev(true)

      tapVersion(3)

      expect(mockNavigate).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith("developerScreen")
    })

    it("does not navigate before the third tap in development builds", () => {
      setDev(true)

      tapVersion(2)

      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("does not navigate after three taps in release builds", () => {
      setDev(false)

      tapVersion(3)

      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  it("enables the ip lookup outside Anon mode", () => {
    mockUsePhoneCountryCode.mockReturnValue("US")
    mockUseIpCountryCode.mockReturnValue("SE")

    render(<VersionComponent />)

    expect(mockUseIpCountryCode).toHaveBeenCalledWith(true)
  })

  /** Registration is a custodial compliance fact. A self-custodial account never
   *  registers a region, so reporting one would be inventing a fact it does not hold. */
  it("reports only the detected region for a self-custodial account", () => {
    mockActiveAccountType = "self-custodial"
    mockUsePhoneCountryCode.mockReturnValue("US")
    mockUseIpCountryCode.mockReturnValue("SV")

    const { getByText, queryByText } = render(<VersionComponent />)

    expect(getByText(/Detected: SV/)).toBeTruthy()
    expect(queryByText(/Registered:/)).toBeNull()
  })

  it("detects nothing in Incognito, where no region is ever resolved", () => {
    mockActiveAccountType = "self-custodial"
    mockIsAnonMode = true
    mockUsePhoneCountryCode.mockReturnValue(undefined)
    mockUseIpCountryCode.mockReturnValue(undefined)

    const { getByText, queryByText } = render(<VersionComponent />)

    expect(getByText(/Detected: Unknown/)).toBeTruthy()
    expect(queryByText(/Registered:/)).toBeNull()
    expect(queryByText(/Country:/)).toBeNull()
  })

  /** Incognito must not leak a detected region even if the lookup somehow resolved one. */
  it("still detects nothing in Incognito when an ip country is present", () => {
    mockActiveAccountType = "self-custodial"
    mockIsAnonMode = true
    mockUsePhoneCountryCode.mockReturnValue("US")
    mockUseIpCountryCode.mockReturnValue("SV")

    const { getByText, queryByText } = render(<VersionComponent />)

    expect(getByText(/Detected: Unknown/)).toBeTruthy()
    expect(queryByText(/SV/)).toBeNull()
  })

  it("keeps both registered and detected for a custodial account", () => {
    mockActiveAccountType = "custodial"
    mockUsePhoneCountryCode.mockReturnValue("US")
    mockUseIpCountryCode.mockReturnValue("SE")

    const { getByText } = render(<VersionComponent />)

    expect(getByText(/Registered: US · Detected: SE/)).toBeTruthy()
  })
})
