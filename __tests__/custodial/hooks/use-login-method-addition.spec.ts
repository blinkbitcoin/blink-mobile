import { renderHook } from "@testing-library/react-native"

import { useLoginMethodAddition } from "@app/custodial/hooks/use-login-method-addition"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import {
  LoginMethodAddition,
  LoginMethodAdditionParams,
  LoginMethodAdditionResult,
} from "@app/types/two-factor-enforcement"

loadLocale("en")
const LL = i18nObject("en")

const CODE = "123456"
const EMAIL = "someone@example.com"
const PHONE = "+50760000000"
const SMS_CODE = "000000"

const mockSetParams = jest.fn()
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ setParams: mockSetParams }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL }),
}))

const mockUpdateCurrentProfile = jest.fn()
jest.mock("@app/hooks/use-save-session-profile", () => ({
  useSaveSessionProfile: () => ({ updateCurrentProfile: mockUpdateCurrentProfile }),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const mockRemove = jest.fn()
jest.mock("@app/custodial/hooks/use-email-removal", () => ({
  useEmailRemoval: () => ({ remove: mockRemove }),
}))

const mockAddPhone = jest.fn()
jest.mock("@app/custodial/hooks/use-phone-addition", () => ({
  usePhoneAddition: () => ({ add: mockAddPhone }),
}))

const mockEmailInitiate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserEmailRegistrationInitiateMutation: () => [mockEmailInitiate],
}))

const CODE_INVALID = { code: "TOTP_CODE_INVALID", message: "Invalid code" }

const emailInitiated = (
  errors: unknown[] = [],
  emailRegistrationId: string | null = "reg",
) => ({
  data: { userEmailRegistrationInitiate: { errors, emailRegistrationId } },
})

const EMAIL_REGISTERED = {
  result: LoginMethodAdditionResult.EmailRegistered,
  email: EMAIL,
  emailRegistrationId: "reg",
}
const PHONE_ADDED = { result: LoginMethodAdditionResult.PhoneAdded }
const ABANDONED = { result: LoginMethodAdditionResult.Abandoned }
const refused = (refusal: object) => ({
  result: LoginMethodAdditionResult.Refused,
  refusal,
})

/** Whether the screen and the session the addition began under are still there. */
const mockIsOwnSession = jest.fn()

const runAddition = (params: LoginMethodAdditionParams) => {
  const { result } = renderHook(() => useLoginMethodAddition())
  return result.current.run({ params, totpCode: CODE, isOwnSession: mockIsOwnSession })
}

// eslint-disable-next-line max-lines-per-function -- one hook's suite: every addition shares the mocked requests above
describe("useLoginMethodAddition", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsOwnSession.mockReturnValue(true)
    mockUpdateCurrentProfile.mockResolvedValue(undefined)
    mockRemove.mockResolvedValue(undefined)
    mockAddPhone.mockResolvedValue(undefined)
    mockEmailInitiate.mockResolvedValue(emailInitiated())
  })

  describe("adding the email", () => {
    const params = { addition: LoginMethodAddition.Email, email: EMAIL } as const

    it("registers it with the code, for its confirmation to follow", async () => {
      expect(await runAddition(params)).toEqual(EMAIL_REGISTERED)
      expect(mockEmailInitiate).toHaveBeenCalledWith({
        variables: { input: { email: EMAIL, totpCode: CODE } },
      })
      expect(mockRemove).not.toHaveBeenCalled()
    })

    it("hands back the server's refusal", async () => {
      mockEmailInitiate.mockResolvedValue(emailInitiated([CODE_INVALID], null))

      expect(await runAddition(params)).toEqual(refused(CODE_INVALID))
    })

    it("refuses a registration the server answers without its id", async () => {
      mockEmailInitiate.mockResolvedValue(emailInitiated([], null))

      expect(await runAddition(params)).toEqual(
        refused({
          message: LL.EmailRegistrationInitiateScreen.missingEmailRegistrationId(),
        }),
      )
    })

    it("throws when the request never answers", async () => {
      mockEmailInitiate.mockRejectedValue(new Error("network down"))

      await expect(runAddition(params)).rejects.toThrow("network down")
    })
  })

  describe("confirming the email again", () => {
    const params = { addition: LoginMethodAddition.EmailReverify, email: EMAIL } as const

    it("removes it with no code, saves the profile and registers it again with the code", async () => {
      expect(await runAddition(params)).toEqual(EMAIL_REGISTERED)
      expect(mockRemove).toHaveBeenCalledTimes(1)
      expect(mockUpdateCurrentProfile).toHaveBeenCalledTimes(1)
      expect(mockEmailInitiate).toHaveBeenCalledWith({
        variables: { input: { email: EMAIL, totpCode: CODE } },
      })
    })

    /** A removal sent again would be refused, as there is no address left. */
    it("asks only to add it once removed, should the registration fail", async () => {
      mockEmailInitiate.mockResolvedValue(emailInitiated([CODE_INVALID], null))

      expect(await runAddition(params)).toEqual(refused(CODE_INVALID))
      expect(mockSetParams).toHaveBeenCalledWith({
        addition: LoginMethodAddition.Email,
        email: EMAIL,
      })
    })

    it("registers nothing when the removal is refused", async () => {
      const refusal = { code: "SOMETHING", message: "Refused" }
      mockRemove.mockResolvedValue(refusal)

      expect(await runAddition(params)).toEqual(refused(refusal))
      expect(mockUpdateCurrentProfile).not.toHaveBeenCalled()
      expect(mockSetParams).not.toHaveBeenCalled()
      expect(mockEmailInitiate).not.toHaveBeenCalled()
    })

    /** Each request goes through the client of the moment: registered after a switch,
     *  the address would land on the other account. */
    it("registers nothing once the session switched during the removal", async () => {
      let finishRemoval: (refusal: undefined) => void = () => {}
      mockRemove.mockReturnValue(
        new Promise((resolve) => {
          finishRemoval = resolve
        }),
      )

      const running = runAddition(params)
      mockIsOwnSession.mockReturnValue(false)
      finishRemoval(undefined)

      expect(await running).toEqual(ABANDONED)
      expect(mockUpdateCurrentProfile).not.toHaveBeenCalled()
      expect(mockSetParams).not.toHaveBeenCalled()
      expect(mockEmailInitiate).not.toHaveBeenCalled()
    })

    it("registers nothing once the session switched while the profile was saved", async () => {
      mockUpdateCurrentProfile.mockImplementation(async () => {
        mockIsOwnSession.mockReturnValue(false)
      })

      expect(await runAddition(params)).toEqual(ABANDONED)
      expect(mockSetParams).not.toHaveBeenCalled()
      expect(mockEmailInitiate).not.toHaveBeenCalled()
    })

    it("registers it again even when the profile fails to save, and reports it", async () => {
      const failure = new Error("keychain")
      mockUpdateCurrentProfile.mockRejectedValue(failure)

      expect(await runAddition(params)).toEqual(EMAIL_REGISTERED)
      expect(mockReportError).toHaveBeenCalledWith("login-method-addition", failure)
    })

    it("throws when the removal never answers", async () => {
      mockRemove.mockRejectedValue(new Error("network down"))

      await expect(runAddition(params)).rejects.toThrow("network down")
      expect(mockEmailInitiate).not.toHaveBeenCalled()
    })
  })

  describe("adding the phone number", () => {
    const params = {
      addition: LoginMethodAddition.Phone,
      phone: PHONE,
      smsCode: SMS_CODE,
    } as const

    it("adds it with the SMS code and the authenticator's, then saves the profile", async () => {
      expect(await runAddition(params)).toEqual(PHONE_ADDED)
      expect(mockAddPhone).toHaveBeenCalledWith({
        phone: PHONE,
        smsCode: SMS_CODE,
        totpCode: CODE,
      })
      expect(mockUpdateCurrentProfile).toHaveBeenCalledTimes(1)
    })

    it("hands back the server's refusal, with no profile saved", async () => {
      mockAddPhone.mockResolvedValue(CODE_INVALID)

      expect(await runAddition(params)).toEqual(refused(CODE_INVALID))
      expect(mockUpdateCurrentProfile).not.toHaveBeenCalled()
    })

    /** The number is on the account either way, so the addition is done; the profile
     *  saved now would be the other account's. */
    it("is done with no profile saved once the session switched", async () => {
      mockIsOwnSession.mockReturnValue(false)

      expect(await runAddition(params)).toEqual(PHONE_ADDED)
      expect(mockUpdateCurrentProfile).not.toHaveBeenCalled()
    })

    it("is done even when the profile fails to save, and reports it", async () => {
      const failure = new Error("keychain")
      mockUpdateCurrentProfile.mockRejectedValue(failure)

      expect(await runAddition(params)).toEqual(PHONE_ADDED)
      expect(mockReportError).toHaveBeenCalledWith("login-method-addition", failure)
    })

    it("throws when the request never answers and did not land", async () => {
      mockAddPhone.mockRejectedValue(new Error("network down"))

      await expect(runAddition(params)).rejects.toThrow("network down")
      expect(mockUpdateCurrentProfile).not.toHaveBeenCalled()
    })
  })
})
