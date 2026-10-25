import { Alert, AlertButton } from "react-native"
import { renderHook } from "@testing-library/react-native"

import { useLoginMethodAddition } from "@app/custodial/hooks/use-login-method-addition"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { LoginMethodAddition } from "@app/types/two-factor-enforcement"

loadLocale("en")
const LL = i18nObject("en")

const CODE = "123456"
const EMAIL = "someone@example.com"
const PHONE = "+50760000000"
const SMS_CODE = "000000"

const mockReplace = jest.fn()
const mockSetParams = jest.fn()
const mockPopTo = jest.fn()
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    replace: mockReplace,
    setParams: mockSetParams,
    popTo: mockPopTo,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL }),
}))

const mockUpdateCurrentProfile = jest.fn()
jest.mock("@app/hooks/use-save-session-profile", () => ({
  useSaveSessionProfile: () => ({ updateCurrentProfile: mockUpdateCurrentProfile }),
}))

const mockLogAddPhoneAttempt = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logAddPhoneAttempt: () => mockLogAddPhoneAttempt(),
}))

const mockRemove = jest.fn()
jest.mock("@app/custodial/hooks/use-email-removal", () => ({
  useEmailRemoval: () => ({ remove: mockRemove }),
}))

const mockEmailInitiate = jest.fn()
const mockPhoneValidate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserEmailRegistrationInitiateMutation: () => [mockEmailInitiate],
  useUserPhoneRegistrationValidateMutation: () => [mockPhoneValidate],
}))

const CODE_INVALID = { code: "TOTP_CODE_INVALID", message: "Invalid code" }

const emailInitiated = (
  errors: unknown[] = [],
  emailRegistrationId: string | null = "reg",
) => ({
  data: { userEmailRegistrationInitiate: { errors, emailRegistrationId } },
})
const phoneValidated = (errors: unknown[] = []) => ({
  data: { userPhoneRegistrationValidate: { errors } },
})

const runAddition = (
  ...args: Parameters<ReturnType<typeof useLoginMethodAddition>["run"]>
) => {
  const { result } = renderHook(() => useLoginMethodAddition())
  return result.current.run(...args)
}

// eslint-disable-next-line max-lines-per-function -- one hook's suite: every addition shares the mocked mutations above
describe("useLoginMethodAddition", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockUpdateCurrentProfile.mockResolvedValue(undefined)
    mockRemove.mockResolvedValue(undefined)
    mockEmailInitiate.mockResolvedValue(emailInitiated())
    mockPhoneValidate.mockResolvedValue(phoneValidated())
  })

  describe("adding the email", () => {
    it("registers it with the code and opens its confirmation", async () => {
      const outcome = await runAddition(
        { addition: LoginMethodAddition.Email, email: EMAIL },
        CODE,
      )

      expect(outcome).toEqual({ isDone: true })
      expect(mockEmailInitiate).toHaveBeenCalledWith({
        variables: { input: { email: EMAIL, totpCode: CODE } },
      })
      expect(mockReplace).toHaveBeenCalledWith("emailRegistrationValidate", {
        emailRegistrationId: "reg",
        email: EMAIL,
      })
      expect(mockRemove).not.toHaveBeenCalled()
    })

    it("stays on the code when the server refuses it", async () => {
      mockEmailInitiate.mockResolvedValue(emailInitiated([CODE_INVALID], null))

      const outcome = await runAddition(
        { addition: LoginMethodAddition.Email, email: EMAIL },
        CODE,
      )

      expect(outcome).toEqual({ isDone: false, refusal: CODE_INVALID })
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("refuses a registration the server answers without its id", async () => {
      mockEmailInitiate.mockResolvedValue(emailInitiated([], null))

      const outcome = await runAddition(
        { addition: LoginMethodAddition.Email, email: EMAIL },
        CODE,
      )

      expect(outcome).toEqual({
        isDone: false,
        refusal: {
          message: LL.EmailRegistrationInitiateScreen.missingEmailRegistrationId(),
        },
      })
      expect(mockReplace).not.toHaveBeenCalled()
    })
  })

  describe("confirming the email again", () => {
    const params = { addition: LoginMethodAddition.EmailReverify, email: EMAIL } as const

    it("removes it with no code and registers it again with the code", async () => {
      const outcome = await runAddition(params, CODE)

      expect(outcome).toEqual({ isDone: true })
      expect(mockRemove).toHaveBeenCalledTimes(1)
      expect(mockEmailInitiate).toHaveBeenCalledWith({
        variables: { input: { email: EMAIL, totpCode: CODE } },
      })
      expect(mockReplace).toHaveBeenCalledWith("emailRegistrationValidate", {
        emailRegistrationId: "reg",
        email: EMAIL,
      })
    })

    /** A removal sent again would be refused, as there is no address left. */
    it("asks only to add it once removed, should the registration fail", async () => {
      mockEmailInitiate.mockResolvedValue(emailInitiated([CODE_INVALID], null))

      const outcome = await runAddition(params, CODE)

      expect(mockSetParams).toHaveBeenCalledWith({
        addition: LoginMethodAddition.Email,
        email: EMAIL,
      })
      expect(outcome).toEqual({ isDone: false, refusal: CODE_INVALID })
    })

    it("registers nothing when the removal is refused", async () => {
      const refusal = { code: "SOMETHING", message: "Refused" }
      mockRemove.mockResolvedValue(refusal)

      const outcome = await runAddition(params, CODE)

      expect(outcome).toEqual({ isDone: false, refusal })
      expect(mockSetParams).not.toHaveBeenCalled()
      expect(mockEmailInitiate).not.toHaveBeenCalled()
    })

    it("throws when the removal never answers", async () => {
      mockRemove.mockRejectedValue(new Error("network down"))

      await expect(runAddition(params, CODE)).rejects.toThrow("network down")
      expect(mockEmailInitiate).not.toHaveBeenCalled()
    })
  })

  describe("adding the phone number", () => {
    const params = {
      addition: LoginMethodAddition.Phone,
      phone: PHONE,
      smsCode: SMS_CODE,
    } as const

    it("confirms it with the SMS code and the authenticator's, then goes back to the settings", async () => {
      const outcome = await runAddition(params, CODE)

      expect(outcome).toEqual({ isDone: true })
      expect(mockLogAddPhoneAttempt).toHaveBeenCalledTimes(1)
      expect(mockPhoneValidate).toHaveBeenCalledWith({
        variables: { input: { phone: PHONE, code: SMS_CODE, totpCode: CODE } },
      })
      expect(mockUpdateCurrentProfile).toHaveBeenCalledTimes(1)
      expect(Alert.alert).toHaveBeenCalledWith(
        LL.PhoneRegistrationValidateScreen.successTitle(),
        undefined,
        expect.any(Array),
      )

      const [, , buttons] = jest.mocked(Alert.alert).mock.calls[0]
      ;(buttons as AlertButton[])[0].onPress?.()
      expect(mockPopTo).toHaveBeenCalledWith("settings")
    })

    it("says nothing of success when the server refuses it", async () => {
      mockPhoneValidate.mockResolvedValue(phoneValidated([CODE_INVALID]))

      const outcome = await runAddition(params, CODE)

      expect(outcome).toEqual({ isDone: false, refusal: CODE_INVALID })
      expect(mockUpdateCurrentProfile).not.toHaveBeenCalled()
      expect(Alert.alert).not.toHaveBeenCalled()
    })

    it("throws on a request that never answers", async () => {
      mockPhoneValidate.mockRejectedValue(new Error("network down"))

      await expect(runAddition(params, CODE)).rejects.toThrow("network down")
    })
  })
})
