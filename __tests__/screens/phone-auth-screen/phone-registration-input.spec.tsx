import React from "react"
import { StyleProp, StyleSheet, ViewStyle } from "react-native"
import { Input } from "@rn-vui/themed"
import { render } from "@testing-library/react-native"

import { PhoneCodeChannelType } from "@app/graphql/generated"
import { PhoneRegistrationInitiateScreen } from "@app/screens/phone-auth-screen/phone-registration-input"
import {
  RequestPhoneCodeStatus,
  type UseRequestPhoneCodeReturn,
} from "@app/screens/phone-auth-screen/request-phone-code-registration"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../helper"

const mockCountryCodePicker = jest.fn()
jest.mock("@app/components/phone-input/country-code-picker", () => ({
  CountryCodePicker: (props: Record<string, unknown>) => {
    mockCountryCodePicker(props)
    return null
  },
}))

/** The real hook module is loaded for its status and error constants, so the location
 *  lookup it pulls in is stubbed to keep its missing-API-key warning out of the run. */
jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => ({ countryCode: undefined, loading: false }),
}))

/** Typed against the hook's own return contract, so renaming a field the screen reads
 *  fails here at compile time instead of leaving these tests green over a screen that
 *  silently falls back to its defaults. */
const mockRequestPhoneCodeRegistration: jest.Mock<UseRequestPhoneCodeReturn> = jest.fn()
jest.mock("@app/screens/phone-auth-screen/request-phone-code-registration", () => ({
  ...jest.requireActual("@app/screens/phone-auth-screen/request-phone-code-registration"),
  useRequestPhoneCodeRegistration: () => mockRequestPhoneCodeRegistration(),
}))

/** rn-vui types `Input`'s ref as the bare TextInput underneath it, which does not fit a
 *  component type. Only the container style is read here. */
const ThemedInput = Input as unknown as React.ComponentType<{
  containerStyle: StyleProp<ViewStyle>
}>

const renderScreen = async () => {
  const screen = render(
    <ContextForScreen>
      <PhoneRegistrationInitiateScreen />
    </ContextForScreen>,
  )
  await flushEffects()
  return screen
}

const countryButtonStyle = () => {
  const [props] = mockCountryCodePicker.mock.calls.at(-1) ?? []
  return StyleSheet.flatten(props.buttonStyle as StyleProp<ViewStyle>)
}

describe("PhoneRegistrationInitiateScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequestPhoneCodeRegistration.mockReturnValue({
      status: RequestPhoneCodeStatus.InputtingPhoneNumber,
      setStatus: jest.fn(),
      phoneInputInfo: {
        countryCode: "SV",
        countryCallingCode: "503",
        formattedPhoneNumber: "",
        rawPhoneNumber: "",
      },
      validatedPhoneNumber: undefined,
      error: undefined,
      userSubmitPhoneNumber: jest.fn(),
      phoneCodeChannel: PhoneCodeChannelType.Sms,
      isWhatsAppSupported: true,
      isSmsSupported: true,
      setCountryCode: jest.fn(),
      setPhoneNumber: jest.fn(),
      supportedCountries: ["SV", "US"],
    })
  })

  it("renders both halves of the phone row", async () => {
    const { getByTestId } = await renderScreen()

    /** Reached by the same test id as the login screen's field. Querying the rn-vui
     *  component type instead would break on any upgrade that re-wraps `Input`, and would
     *  leave the field unreachable from e2e and accessibility tooling. */
    expect(mockCountryCodePicker).toHaveBeenCalled()
    expect(getByTestId("telephoneNumber")).toBeTruthy()
  })

  it("leaves the row's free space to the phone field, not to the country button", async () => {
    // eslint-disable-next-line camelcase -- testing-library exposes this API verbatim
    const { UNSAFE_getByType } = await renderScreen()

    /** The registration screen carried its own copy of the login screen's row styles, so
     *  it grew the country button in the same way and needs the same guard. */
    const button = countryButtonStyle()
    expect(button.flex).toBeUndefined()
    expect(button.flexGrow).toBeUndefined()

    const field = StyleSheet.flatten(UNSAFE_getByType(ThemedInput).props.containerStyle)
    expect(field.flex).toBe(1)
  })

  it("sizes the country button to the flag and the calling code", async () => {
    await renderScreen()

    const button = countryButtonStyle()
    expect(button.minWidth).toBe(110)
    expect(button.width).toBeUndefined()
    expect(button.flexBasis).toBeUndefined()
  })
})
