import React from "react"
import { Alert, AlertButton } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import {
  LoginMethodCodeScreen,
  loginMethodCodeCopy,
} from "@app/screens/totp-screen/login-method-code-screen"
import {
  LoginMethod,
  LoginMethodAddition,
  LoginMethodAdditionParams,
  LoginMethodAdditionResult,
} from "@app/types/two-factor-enforcement"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../helper"

const mockGoBack = jest.fn()
const mockReplace = jest.fn()
const mockPopTo = jest.fn()
let mockParams: LoginMethodAdditionParams = {
  addition: LoginMethodAddition.EmailReverify,
  email: "someone@example.com",
}
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ goBack: mockGoBack, replace: mockReplace, popTo: mockPopTo }),
  useRoute: () => ({ params: mockParams }),
}))

const mockRun = jest.fn()
jest.mock("@app/custodial/hooks/use-login-method-addition", () => ({
  useLoginMethodAddition: () => ({ run: mockRun }),
}))

/** Whether the screen and the session the code was sent from are still there. */
const mockIsOwnSession = jest.fn()
jest.mock("@app/hooks/use-session-guard", () => ({
  useSessionGuard: () => ({ captureSession: () => () => mockIsOwnSession() }),
}))

const mockCodeCheckHold = jest.fn()
jest.mock("@app/hooks/use-code-check-hold", () => ({
  useCodeCheckHold: (isChecking: boolean) => mockCodeCheckHold(isChecking),
}))

const mockLogCodeFailed = jest.fn()
const mockLogValidateFailure = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  ...jest.requireActual("@app/utils/analytics"),
  logLoginMethodCodeFailed: (...args: unknown[]) => mockLogCodeFailed(...args),
  logValidateAuthCodeFailure: (...args: unknown[]) => mockLogValidateFailure(...args),
}))

/** The code field as the screen uses it: what it is told to show, and a submit. */
const mockCodeInput = jest.fn()
jest.mock("@app/components/code-input", () => {
  const ReactActual = jest.requireActual("react")
  const { Pressable, Text } = jest.requireActual("react-native")
  return {
    CodeInput: (props: {
      send: (code: string) => void
      header: string
      errorMessage: string
      loading: boolean
    }) => {
      mockCodeInput(props)
      return ReactActual.createElement(
        Pressable,
        { testID: "submit-code", onPress: () => props.send("123456") },
        ReactActual.createElement(Text, null, props.header),
      )
    },
  }
})

loadLocale("en")
const LL = i18nObject("en")

const EMAIL = "someone@example.com"

const refused = (code: string, message = "refused") => ({
  result: LoginMethodAdditionResult.Refused,
  refusal: { code, message },
})

const EMAIL_REGISTERED = {
  result: LoginMethodAdditionResult.EmailRegistered,
  email: EMAIL,
  emailRegistrationId: "reg",
}
const PHONE_ADDED = { result: LoginMethodAdditionResult.PhoneAdded }

const PHONE_PARAMS: LoginMethodAdditionParams = {
  addition: LoginMethodAddition.Phone,
  phone: "+50760000000",
  smsCode: "000000",
}

/** A run the test answers when it wants, to leave the screen in between. */
const deferRun = () => {
  let answer: (outcome: object) => void = () => {}
  let fail: (err: Error) => void = () => {}
  mockRun.mockReturnValue(
    new Promise((resolve, reject) => {
      answer = resolve
      fail = reject
    }),
  )
  return { answer: (outcome: object) => answer(outcome), fail: (err: Error) => fail(err) }
}

const pressSuccessOk = () => {
  const [, , buttons] = jest.mocked(Alert.alert).mock.calls[0]
  ;(buttons as AlertButton[])[0].onPress?.()
}

const lastCodeInput = () => mockCodeInput.mock.calls.at(-1)?.[0]

const submitCode = async () => {
  render(
    <ContextForScreen>
      <LoginMethodCodeScreen />
    </ContextForScreen>,
  )
  await flushEffects()
  await act(async () => {
    fireEvent.press(screen.getByTestId("submit-code"))
  })
}

describe("loginMethodCodeCopy", () => {
  const cases = [
    [LoginMethodAddition.EmailReverify, "addEmailTitle", "addEmailCode"],
    [LoginMethodAddition.Email, "addEmailTitle", "addEmailCode"],
    [LoginMethodAddition.Phone, "addPhoneTitle", "addPhoneCode"],
  ] as const

  for (const [addition, title, instruction] of cases) {
    it(`says ${title} for ${addition}`, () => {
      expect(loginMethodCodeCopy(LL, addition)).toEqual({
        title: LL.LoginMethodCode[title](),
        instruction: LL.LoginMethodCode[instruction](),
      })
    })
  }
})

// eslint-disable-next-line max-lines-per-function -- one screen's suite, sharing the mocked hook and code field above
describe("LoginMethodCodeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockParams = { addition: LoginMethodAddition.EmailReverify, email: EMAIL }
    mockIsOwnSession.mockReturnValue(true)
    mockRun.mockResolvedValue(EMAIL_REGISTERED)
  })

  it("asks for the code with what the addition does", async () => {
    mockParams = { addition: LoginMethodAddition.EmailReverify, email: EMAIL }

    await submitCode()

    expect(screen.getByText(LL.LoginMethodCode.addEmailCode())).toBeTruthy()
  })

  it("runs the addition with the code typed, then opens the email's confirmation", async () => {
    mockParams = { addition: LoginMethodAddition.Email, email: EMAIL }

    await submitCode()

    expect(mockRun).toHaveBeenCalledWith({
      params: mockParams,
      totpCode: "123456",
      isOwnSession: expect.any(Function),
    })
    expect(mockReplace).toHaveBeenCalledWith("emailRegistrationValidate", {
      email: EMAIL,
      emailRegistrationId: "reg",
    })
    expect(Alert.alert).not.toHaveBeenCalled()
    expect(lastCodeInput().errorMessage).toBe("")
    expect(lastCodeInput().loading).toBe(false)
  })

  it("carries the onboarding on to the email's confirmation", async () => {
    mockParams = {
      addition: LoginMethodAddition.Email,
      email: EMAIL,
      onboarding: true,
      hasUsername: true,
    }

    await submitCode()

    expect(mockReplace).toHaveBeenCalledWith("emailRegistrationValidate", {
      email: EMAIL,
      emailRegistrationId: "reg",
      onboarding: true,
      hasUsername: true,
    })
  })

  it("opens the confirmation of an email confirmed again with no onboarding", async () => {
    await submitCode()

    const [, confirmation] = mockReplace.mock.calls[0]
    expect(confirmation).toEqual({ email: EMAIL, emailRegistrationId: "reg" })
  })

  it("holds the ways back only while the code is checked", async () => {
    const run = deferRun()
    await submitCode()
    expect(mockCodeCheckHold).toHaveBeenLastCalledWith(true)

    await act(async () => run.answer(EMAIL_REGISTERED))

    expect(mockCodeCheckHold).toHaveBeenLastCalledWith(false)
  })

  it("shows nothing for an addition left off", async () => {
    mockRun.mockResolvedValue({ result: LoginMethodAdditionResult.Abandoned })

    await submitCode()

    expect(mockReplace).not.toHaveBeenCalled()
    expect(Alert.alert).not.toHaveBeenCalled()
    expect(lastCodeInput().loading).toBe(false)
  })

  /** The user left once the hold let go, or an account switch reset the stack: the
   *  answer must not move a screen the code was never sent from. */
  describe("an answer that comes once the screen or its session is gone", () => {
    it("opens no confirmation", async () => {
      const run = deferRun()
      await submitCode()

      mockIsOwnSession.mockReturnValue(false)
      await act(async () => run.answer(EMAIL_REGISTERED))

      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("says no success", async () => {
      mockParams = PHONE_PARAMS
      const run = deferRun()
      await submitCode()

      mockIsOwnSession.mockReturnValue(false)
      await act(async () => run.answer(PHONE_ADDED))

      expect(Alert.alert).not.toHaveBeenCalled()
    })

    it("says no refusal and goes nowhere", async () => {
      mockParams = PHONE_PARAMS
      const run = deferRun()
      await submitCode()

      mockIsOwnSession.mockReturnValue(false)
      await act(async () => run.answer(refused("PHONE_CODE_ERROR")))

      expect(Alert.alert).not.toHaveBeenCalled()
      expect(mockGoBack).not.toHaveBeenCalled()
    })

    it("says no error", async () => {
      const run = deferRun()
      await submitCode()

      mockIsOwnSession.mockReturnValue(false)
      await act(async () => run.fail(new Error("network")))

      expect(Alert.alert).not.toHaveBeenCalled()
    })
  })

  it("says a wrong code under the field and counts it", async () => {
    mockParams = {
      addition: LoginMethodAddition.Phone,
      phone: "+50760000000",
      smsCode: "000000",
    }
    mockRun.mockResolvedValue(refused("TOTP_CODE_INVALID"))

    await submitCode()

    expect(lastCodeInput().errorMessage).toBe(LL.LoginMethodCode.codeInvalid())
    expect(mockLogCodeFailed).toHaveBeenCalledWith({ loginMethod: LoginMethod.Phone })
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it("says under the field when the hour's tries are spent", async () => {
    mockRun.mockResolvedValue(refused("TOO_MANY_REQUEST"))

    await submitCode()

    expect(lastCodeInput().errorMessage).toBe(LL.LoginMethodCode.tooManyAttempts())
    expect(mockLogCodeFailed).not.toHaveBeenCalled()
  })

  it("shows any other refusal as the server says it", async () => {
    mockRun.mockResolvedValue(refused("SOMETHING_ELSE", "Not allowed"))

    await submitCode()

    expect(Alert.alert).toHaveBeenCalledWith(LL.common.error(), "Not allowed")
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  describe("adding the phone number", () => {
    beforeEach(() => {
      mockParams = {
        addition: LoginMethodAddition.Phone,
        phone: "+50760000000",
        smsCode: "000000",
      }
    })

    it("sends the user back to the SMS code the server refused", async () => {
      mockRun.mockResolvedValue(refused("PHONE_CODE_ERROR"))

      await submitCode()

      expect(Alert.alert).toHaveBeenCalledWith(
        LL.common.error(),
        LL.PhoneLoginValidationScreen.errorLoggingIn(),
      )
      expect(mockLogValidateFailure).toHaveBeenCalledWith({ error: "InvalidCode" })
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("says a phone number another account has, and goes back", async () => {
      mockRun.mockResolvedValue(refused("PHONE_ACCOUNT_ALREADY_EXISTS_ERROR"))

      await submitCode()

      expect(Alert.alert).toHaveBeenCalledWith(
        LL.common.error(),
        LL.PhoneLoginValidationScreen.errorCannotUpgradeToExistingAccount(),
      )
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("says the generic error for a refusal with no words of its own", async () => {
      mockRun.mockResolvedValue({
        result: LoginMethodAdditionResult.Refused,
        refusal: { code: "OTHER" },
      })

      await submitCode()

      expect(Alert.alert).toHaveBeenCalledWith(LL.common.error(), LL.errors.generic())
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("says the number is added, then goes back to the settings", async () => {
      mockRun.mockResolvedValue(PHONE_ADDED)
      await submitCode()

      expect(Alert.alert).toHaveBeenCalledWith(
        LL.PhoneRegistrationValidateScreen.successTitle(),
        undefined,
        expect.any(Array),
      )
      pressSuccessOk()

      expect(mockPopTo).toHaveBeenCalledWith("settings")
    })

    /** The success alert outlives a stack an account switch reset under it. */
    it("goes nowhere from the success once the session is gone", async () => {
      mockRun.mockResolvedValue(PHONE_ADDED)
      await submitCode()

      mockIsOwnSession.mockReturnValue(false)
      pressSuccessOk()

      expect(mockPopTo).not.toHaveBeenCalled()
    })

    it("keeps a wrong authenticator's code on the field", async () => {
      mockRun.mockResolvedValue(refused("TOTP_CODE_INVALID"))

      await submitCode()

      expect(lastCodeInput().errorMessage).toBe(LL.LoginMethodCode.codeInvalid())
      expect(mockGoBack).not.toHaveBeenCalled()
    })
  })

  it("shows an error when the request never answers", async () => {
    mockRun.mockRejectedValue(new Error("network"))

    await submitCode()

    expect(Alert.alert).toHaveBeenCalledWith(LL.common.error())
    expect(lastCodeInput().loading).toBe(false)
  })

  it("checks one code at a time", async () => {
    let finish: (value: unknown) => void = () => {}
    mockRun.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(
      <ContextForScreen>
        <LoginMethodCodeScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-code"))
      fireEvent.press(screen.getByTestId("submit-code"))
    })
    expect(lastCodeInput().loading).toBe(true)

    await act(async () => finish(EMAIL_REGISTERED))

    expect(mockRun).toHaveBeenCalledTimes(1)
  })

  /** Adding a phone number waits on its success alert with the code still in the
   *  field: handed over again, it must not reach the server, which would refuse it. */
  it("sends nothing more once the addition is done", async () => {
    mockParams = PHONE_PARAMS
    mockRun.mockResolvedValue(PHONE_ADDED)
    await submitCode()
    expect(mockRun).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-code"))
    })

    expect(mockRun).toHaveBeenCalledTimes(1)
  })

  it("lets the code be sent again after a refusal", async () => {
    mockRun.mockResolvedValueOnce(refused("TOTP_CODE_INVALID"))
    await submitCode()

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-code"))
    })

    expect(mockRun).toHaveBeenCalledTimes(2)
  })
})
