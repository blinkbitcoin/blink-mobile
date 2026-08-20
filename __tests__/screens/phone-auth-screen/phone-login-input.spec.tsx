import React from "react"
import { StyleProp, StyleSheet, ViewStyle } from "react-native"
import { Input } from "@rn-vui/themed"
import { render } from "@testing-library/react-native"
import type { RouteProp } from "@react-navigation/native"

import { PhoneCodeChannelType } from "@app/graphql/generated"
import type { PhoneValidationStackParamList } from "@app/navigation/stack-param-lists"
import { PhoneLoginInitiateType } from "@app/screens/phone-auth-screen/phone-login-initiate-type"
import { PhoneLoginInitiateScreen } from "@app/screens/phone-auth-screen/phone-login-input"
import {
  RequestPhoneCodeStatus,
  type UseRequestPhoneCodeReturn,
} from "@app/screens/phone-auth-screen/request-phone-code-login"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../helper"

const mockCountryCodePicker = jest.fn()
jest.mock("@app/components/phone-input/country-code-picker", () => ({
  CountryCodePicker: (props: Record<string, unknown>) => {
    mockCountryCodePicker(props)
    return null
  },
}))

/** Two leaves of the real hook module, kept out of the way so the partial mock below can
 *  still hand the screen its genuine status and error constants: app-check reaches for a
 *  native module no test has, and the location lookup warns about missing API keys. */
jest.mock("@app/screens/get-started-screen/use-device-token", () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => ({ countryCode: undefined, loading: false }),
}))

/** Typed against the hook's own return contract, so renaming a field the screen reads
 *  fails here at compile time instead of leaving these tests green over a screen that
 *  silently falls back to its defaults. */
const mockRequestPhoneCodeLogin: jest.Mock<UseRequestPhoneCodeReturn> = jest.fn()
jest.mock("@app/screens/phone-auth-screen/request-phone-code-login", () => ({
  ...jest.requireActual("@app/screens/phone-auth-screen/request-phone-code-login"),
  useRequestPhoneCodeLogin: () => mockRequestPhoneCodeLogin(),
}))

const route = {
  key: "phoneLoginInitiate",
  name: "phoneLoginInitiate",
  params: {
    type: PhoneLoginInitiateType.Login,
    channel: PhoneCodeChannelType.Sms,
    title: "Use SMS",
  },
} as unknown as RouteProp<PhoneValidationStackParamList, "phoneLoginInitiate">

/** rn-vui types `Input`'s ref as the bare TextInput underneath it, which does not fit a
 *  component type. Only the container style is read here. */
const ThemedInput = Input as unknown as React.ComponentType<{
  containerStyle: StyleProp<ViewStyle>
}>

const renderScreen = async () => {
  const screen = render(
    <ContextForScreen>
      <PhoneLoginInitiateScreen route={route} />
    </ContextForScreen>,
  )
  await flushEffects()
  return screen
}

const countryButtonStyle = () => {
  const [props] = mockCountryCodePicker.mock.calls.at(-1) ?? []
  return StyleSheet.flatten(props.buttonStyle as StyleProp<ViewStyle>)
}

describe("PhoneLoginInitiateScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequestPhoneCodeLogin.mockReturnValue({
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
      isTelegramSupported: true,
      isWhatsAppSupported: true,
      isSmsSupported: true,
      captchaLoading: false,
      setCountryCode: jest.fn(),
      setPhoneNumber: jest.fn(),
      supportedCountries: ["SV", "US"],
      loadingSupportedCountries: false,
    })
  })

  it("renders both halves of the phone row", async () => {
    const { getByTestId } = await renderScreen()

    expect(mockCountryCodePicker).toHaveBeenCalled()
    expect(getByTestId("telephoneNumber")).toBeTruthy()
  })

  it("leaves the row's free space to the phone field, not to the country button", async () => {
    // eslint-disable-next-line camelcase -- testing-library exposes this API verbatim
    const { UNSAFE_getByType } = await renderScreen()

    /** Both halves growing is what broke the layout: the button took half the row and the
     *  number was squeezed into what was left. Exactly one of them may grow. */
    const button = countryButtonStyle()
    expect(button.flex).toBeUndefined()
    expect(button.flexGrow).toBeUndefined()

    const field = StyleSheet.flatten(UNSAFE_getByType(ThemedInput).props.containerStyle)
    expect(field.flex).toBe(1)
  })

  it("sizes the country button to the flag and the calling code", async () => {
    await renderScreen()

    /** A floor, not a width: it only keeps the button from twitching between a "+1" and a
     *  "+503". Anything that pins a wider size would push the number out again. */
    const button = countryButtonStyle()
    expect(button.minWidth).toBe(110)
    expect(button.width).toBeUndefined()
    expect(button.flexBasis).toBeUndefined()
  })
})
