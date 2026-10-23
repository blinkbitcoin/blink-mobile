import React from "react"
import { Alert } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import {
  ContactChangeCodeScreen,
  contactChangeCopy,
} from "@app/screens/totp-screen/contact-change-code-screen"
import {
  ContactChangeStep,
  ContactChangeStepParams,
  ContactField,
} from "@app/types/two-factor-enforcement"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../helper"

const mockGoBack = jest.fn()
let mockParams: ContactChangeStepParams = { step: ContactChangeStep.EmailRemove }
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockParams }),
}))

const mockRun = jest.fn()
jest.mock("@app/custodial/hooks/use-contact-change-steps", () => ({
  useContactChangeSteps: () => ({ run: mockRun }),
}))

const mockLogCodeFailed = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  ...jest.requireActual("@app/utils/analytics"),
  logContactChangeCodeFailed: (...args: unknown[]) => mockLogCodeFailed(...args),
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
  isDone: false,
  refusal: { code, message },
})

const lastCodeInput = () => mockCodeInput.mock.calls.at(-1)?.[0]

const submitCode = async () => {
  render(
    <ContextForScreen>
      <ContactChangeCodeScreen />
    </ContextForScreen>,
  )
  await flushEffects()
  await act(async () => {
    fireEvent.press(screen.getByTestId("submit-code"))
  })
}

describe("contactChangeCopy", () => {
  const cases = [
    [ContactChangeStep.EmailRemove, "changeEmailTitle", "changeEmailCode"],
    [ContactChangeStep.EmailReverify, "changeEmailTitle", "changeEmailCode"],
    [ContactChangeStep.EmailAdd, "addEmailTitle", "addEmailCode"],
    [ContactChangeStep.PhoneRemove, "changePhoneTitle", "changePhoneCode"],
    [ContactChangeStep.PhoneAdd, "addPhoneTitle", "addPhoneCode"],
  ] as const

  for (const [step, title, instruction] of cases) {
    it(`says ${title} for ${step}`, () => {
      expect(contactChangeCopy(LL, step)).toEqual({
        title: LL.ContactChange[title](),
        instruction: LL.ContactChange[instruction](),
      })
    })
  }
})

// eslint-disable-next-line max-lines-per-function -- one screen's suite, sharing the mocked steps and code field above
describe("ContactChangeCodeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockParams = { step: ContactChangeStep.EmailRemove }
    mockRun.mockResolvedValue({ isDone: true })
  })

  it("asks for the code with what the step does", async () => {
    mockParams = { step: ContactChangeStep.PhoneRemove }

    await submitCode()

    expect(screen.getByText(LL.ContactChange.changePhoneCode())).toBeTruthy()
  })

  it("runs the step with the code typed, leaving the screen to it", async () => {
    mockParams = { step: ContactChangeStep.EmailAdd, email: EMAIL }

    await submitCode()

    expect(mockRun).toHaveBeenCalledWith(mockParams, "123456")
    expect(Alert.alert).not.toHaveBeenCalled()
    expect(lastCodeInput().errorMessage).toBe("")
    expect(lastCodeInput().loading).toBe(false)
  })

  it("says a wrong code under the field and counts it", async () => {
    mockParams = { step: ContactChangeStep.PhoneRemove }
    mockRun.mockResolvedValue(refused("TOTP_CODE_INVALID"))

    await submitCode()

    expect(lastCodeInput().errorMessage).toBe(LL.ContactChange.codeInvalid())
    expect(mockLogCodeFailed).toHaveBeenCalledWith({ field: ContactField.Phone })
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it("says under the field when the hour's tries are spent", async () => {
    mockRun.mockResolvedValue(refused("TOO_MANY_REQUEST"))

    await submitCode()

    expect(lastCodeInput().errorMessage).toBe(LL.ContactChange.tooManyAttempts())
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
        step: ContactChangeStep.PhoneAdd,
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
      mockRun.mockResolvedValue({ isDone: false, refusal: { code: "OTHER" } })

      await submitCode()

      expect(Alert.alert).toHaveBeenCalledWith(LL.common.error(), LL.errors.generic())
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("keeps a wrong authenticator's code on the field", async () => {
      mockRun.mockResolvedValue(refused("TOTP_CODE_INVALID"))

      await submitCode()

      expect(lastCodeInput().errorMessage).toBe(LL.ContactChange.codeInvalid())
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
        <ContactChangeCodeScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-code"))
      fireEvent.press(screen.getByTestId("submit-code"))
    })
    expect(lastCodeInput().loading).toBe(true)

    await act(async () => finish({ isDone: true }))

    expect(mockRun).toHaveBeenCalledTimes(1)
  })
})
