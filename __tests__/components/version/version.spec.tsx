import * as React from "react"
import { Text as ReactNativeText } from "react-native"
import { render } from "@testing-library/react-native"

import { VersionComponent } from "@app/components/version"

const mockUseRegistrationCountry = jest.fn()

jest.mock("@app/hooks/use-registration-country", () => ({
  useRegistrationCountry: () => mockUseRegistrationCountry(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        country: () => "Country",
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
    mockUseRegistrationCountry.mockReset()
  })

  it("shows the registration country below the version", () => {
    mockUseRegistrationCountry.mockReturnValue({ countryCode: "HK" })

    const { getByText } = render(<VersionComponent />)

    expect(getByText(/Country: HK/)).toBeTruthy()
  })

  it("falls back to the unknown label when the country is not detected", () => {
    mockUseRegistrationCountry.mockReturnValue({ countryCode: undefined })

    const { getByText } = render(<VersionComponent />)

    expect(getByText(/Country: Unknown/)).toBeTruthy()
  })
})
