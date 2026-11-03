import React from "react"
import { Alert, AlertButton } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { PhoneCodeChannelType } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { PhoneRegistrationValidateScreen } from "@app/screens/phone-auth-screen/phone-registration-validation"
import { LoginMethodAddition } from "@app/types/two-factor-enforcement"
import { RouteProp } from "@react-navigation/native"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../helper"

loadLocale("en")
const LL = i18nObject("en")

const PHONE = "+50760000000"
const SMS_CODE = "123456"

const mockNavigate = jest.fn()
const mockPop = jest.fn()
const mockGoBack = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, pop: mockPop, goBack: mockGoBack }),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

/** The friendly channel names alone: the module behind them loads app-check. */
jest.mock("@app/screens/phone-auth-screen/request-phone-code-login", () => ({
  PhoneCodeChannelToFriendlyName: {
    SMS: "SMS",
    WHATSAPP: "WhatsApp",
    TELEGRAM: "Telegram",
  },
}))

const mockPhoneValidate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserPhoneRegistrationValidateMutation: () => [mockPhoneValidate],
}))

let mockHasAuthenticator = false
jest.mock("@app/screens/settings-screen/account/login-methods-hook", () => ({
  useLoginMethods: () => ({ hasAuthenticator: mockHasAuthenticator }),
}))

const mockUpdateCurrentProfile = jest.fn()
jest.mock("@app/hooks/use-save-session-profile", () => ({
  useSaveSessionProfile: () => ({ updateCurrentProfile: mockUpdateCurrentProfile }),
}))

const route: RouteProp<RootStackParamList, "phoneRegistrationValidate"> = {
  key: "phoneRegistrationValidate",
  name: "phoneRegistrationValidate",
  params: { phone: PHONE, channel: PhoneCodeChannelType.Sms },
}

const validated = (errors: { message: string; code?: string }[] = []) => ({
  data: { userPhoneRegistrationValidate: { errors, me: null } },
})

const renderScreen = (channel: PhoneCodeChannelType = PhoneCodeChannelType.Sms) =>
  render(
    <ContextForScreen>
      <PhoneRegistrationValidateScreen
        route={{ ...route, params: { ...route.params, channel } }}
      />
    </ContextForScreen>,
  )

const typeSmsCode = async () => {
  renderScreen()
  await flushEffects()
  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText("000000"), SMS_CODE)
  })
}

const PHONE_ADDITION = {
  addition: LoginMethodAddition.Phone,
  phone: PHONE,
  smsCode: SMS_CODE,
}

describe("PhoneRegistrationValidateScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHasAuthenticator = false
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
    jest.spyOn(console, "debug").mockImplementation(() => {})
    mockUpdateCurrentProfile.mockResolvedValue(undefined)
    mockPhoneValidate.mockResolvedValue(validated())
  })

  it("adds the phone number with the SMS code on an account without an authenticator", async () => {
    await typeSmsCode()

    expect(mockPhoneValidate).toHaveBeenCalledWith({
      variables: { input: { phone: PHONE, code: SMS_CODE } },
    })
    expect(mockUpdateCurrentProfile).toHaveBeenCalledTimes(1)
    const [title, , buttons] = jest.mocked(Alert.alert).mock.calls[0]
    expect(title).toBe(LL.PhoneRegistrationValidateScreen.successTitle())
    ;(buttons as AlertButton[])[0].onPress?.()
    expect(mockPop).toHaveBeenCalledWith(2)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("sends the SMS code on with the authenticator's on an account that has one", async () => {
    mockHasAuthenticator = true

    await typeSmsCode()

    expect(mockPhoneValidate).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("loginMethodCode", PHONE_ADDITION)
    expect(screen.getByPlaceholderText("000000").props.value).toBe("")
  })

  /** The SMS code is not spent by this refusal, so it goes on with the authenticator's. */
  it("asks for the authenticator's code when the server wants one the account did not show yet", async () => {
    mockPhoneValidate.mockResolvedValue(
      validated([{ message: "required", code: "TOTP_CODE_REQUIRED" }]),
    )

    await typeSmsCode()

    expect(mockNavigate).toHaveBeenCalledWith("loginMethodCode", PHONE_ADDITION)
    expect(mockUpdateCurrentProfile).not.toHaveBeenCalled()
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it("says a wrong SMS code and offers to send another", async () => {
    mockPhoneValidate.mockResolvedValue(
      validated([{ message: "wrong", code: "PHONE_CODE_ERROR" }]),
    )

    await typeSmsCode()

    expect(screen.getByText(LL.PhoneLoginValidationScreen.errorLoggingIn())).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("takes nothing past six digits", async () => {
    renderScreen()
    await flushEffects()

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText("000000"), "1234567")
    })

    expect(mockPhoneValidate).not.toHaveBeenCalled()
  })

  it("sends one code at a time", async () => {
    mockPhoneValidate.mockReturnValue(new Promise(() => {}))
    await typeSmsCode()

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText("000000"), SMS_CODE)
    })

    expect(mockPhoneValidate).toHaveBeenCalledTimes(1)
  })

  it("reports a request that fails, and offers to send another code", async () => {
    mockPhoneValidate.mockRejectedValue(new Error("network down"))

    await typeSmsCode()

    expect(mockReportError).toHaveBeenCalledWith(
      "phone-registration-validation",
      expect.any(Error),
    )
    expect(screen.getByText(LL.errors.generic())).toBeTruthy()
    fireEvent.press(screen.getByText(LL.PhoneLoginValidationScreen.sendAgain()))
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("reports nothing for a failure that is not an error", async () => {
    mockPhoneValidate.mockRejectedValue("rejected")

    await typeSmsCode()

    expect(mockReportError).not.toHaveBeenCalled()
    expect(screen.getByText(LL.errors.generic())).toBeTruthy()
  })

  describe("once the wait for the code is over", () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] })
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    const waitOut = async (channel: PhoneCodeChannelType) => {
      renderScreen(channel)
      for (let second = 0; second <= 151; second += 1) {
        await act(async () => {
          jest.advanceTimersByTime(1000)
        })
      }
    }

    it("offers WhatsApp after an SMS", async () => {
      await waitOut(PhoneCodeChannelType.Sms)

      expect(
        screen.getByText(
          LL.PhoneLoginValidationScreen.sendViaOtherChannel({
            channel: "SMS",
            other: "WhatsApp",
          }),
        ),
      ).toBeTruthy()
    })

    it("offers SMS after WhatsApp", async () => {
      await waitOut(PhoneCodeChannelType.Whatsapp)

      expect(
        screen.getByText(
          LL.PhoneLoginValidationScreen.sendViaOtherChannel({
            channel: "WhatsApp",
            other: "SMS",
          }),
        ),
      ).toBeTruthy()
    })
  })

  it("takes an answer with no payload as the number added", async () => {
    mockPhoneValidate.mockResolvedValue({ data: null })

    await typeSmsCode()

    expect(Alert.alert).toHaveBeenCalledWith(
      LL.PhoneRegistrationValidateScreen.successTitle(),
      undefined,
      expect.any(Array),
    )
  })
})
