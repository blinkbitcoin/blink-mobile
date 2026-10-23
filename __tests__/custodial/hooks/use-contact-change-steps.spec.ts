import { Alert, AlertButton } from "react-native"
import { renderHook } from "@testing-library/react-native"

import { useContactChangeSteps } from "@app/custodial/hooks/use-contact-change-steps"
import { SettingsScreenDocument } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ContactChangeStep } from "@app/types/two-factor-enforcement"

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

const mockEmailDelete = jest.fn()
const mockEmailInitiate = jest.fn()
const mockPhoneDelete = jest.fn()
const mockPhoneValidate = jest.fn()
const mockReadAccount = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserEmailDeleteMutation: () => [mockEmailDelete],
  useUserEmailRegistrationInitiateMutation: () => [mockEmailInitiate],
  useUserPhoneDeleteMutation: () => [mockPhoneDelete],
  useUserPhoneRegistrationValidateMutation: () => [mockPhoneValidate],
  useSettingsScreenLazyQuery: () => [mockReadAccount],
  useSettingsScreenQuery: () => ({ data: { me: { id: mockAccountId } } }),
}))

/** The account the settings hold, which a change is for. */
let mockAccountId: string | undefined = "1"

/** A request that may have reached the server, with no answer back. */
const lostAnswer = () =>
  Object.assign(new Error("network down"), { networkError: new Error("offline") })

/** The account as the server reads it back. */
const accountRead = (me: {
  email?: { address: string } | null
  phone?: string | null
}) => ({
  data: { me: { id: "1", ...me } },
})

const CODE_INVALID = { code: "TOTP_CODE_INVALID", message: "Invalid code" }

const emailDeleted = (errors: unknown[] = []) => ({
  data: { userEmailDelete: { errors } },
})
const emailInitiated = (
  errors: unknown[] = [],
  emailRegistrationId: string | null = "reg",
) => ({
  data: { userEmailRegistrationInitiate: { errors, emailRegistrationId } },
})
const phoneDeleted = (errors: unknown[] = []) => ({
  data: { userPhoneDelete: { errors } },
})
const phoneValidated = (errors: unknown[] = []) => ({
  data: { userPhoneRegistrationValidate: { errors } },
})

const runStep = (
  ...args: Parameters<ReturnType<typeof useContactChangeSteps>["run"]>
) => {
  const { result } = renderHook(() => useContactChangeSteps())
  return result.current.run(...args)
}

// eslint-disable-next-line max-lines-per-function -- one hook's suite: every step of the change shares the mocked mutations above
describe("useContactChangeSteps", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, "alert").mockImplementation(() => {})
    mockAccountId = "1"
    mockUpdateCurrentProfile.mockResolvedValue(undefined)
    mockEmailDelete.mockResolvedValue(emailDeleted())
    mockEmailInitiate.mockResolvedValue(emailInitiated())
    mockPhoneDelete.mockResolvedValue(phoneDeleted())
    mockPhoneValidate.mockResolvedValue(phoneValidated())
  })

  describe("removing the email", () => {
    it("removes it with the code and opens the flow that adds the new one", async () => {
      const outcome = await runStep({ step: ContactChangeStep.EmailRemove }, CODE)

      expect(outcome).toEqual({ isDone: true })
      expect(mockEmailDelete).toHaveBeenCalledWith({
        variables: { input: { totpCode: CODE } },
        refetchQueries: [SettingsScreenDocument],
      })
      expect(mockUpdateCurrentProfile).toHaveBeenCalledTimes(1)
      expect(mockReplace).toHaveBeenCalledWith("emailRegistrationInitiate")
    })

    it("stays on the code when the server refuses it", async () => {
      mockEmailDelete.mockResolvedValue(emailDeleted([CODE_INVALID]))

      const outcome = await runStep({ step: ContactChangeStep.EmailRemove }, CODE)

      expect(outcome).toEqual({ isDone: false, refusal: CODE_INVALID })
      expect(mockUpdateCurrentProfile).not.toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
    })
  })

  describe("adding the email", () => {
    it("registers it with the code and opens its confirmation", async () => {
      const outcome = await runStep(
        { step: ContactChangeStep.EmailAdd, email: EMAIL },
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
    })

    it("stays on the code when the server refuses it", async () => {
      mockEmailInitiate.mockResolvedValue(emailInitiated([CODE_INVALID], null))

      const outcome = await runStep(
        { step: ContactChangeStep.EmailAdd, email: EMAIL },
        CODE,
      )

      expect(outcome).toEqual({ isDone: false, refusal: CODE_INVALID })
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("refuses a registration the server answers without its id", async () => {
      mockEmailInitiate.mockResolvedValue(emailInitiated([], null))

      const outcome = await runStep(
        { step: ContactChangeStep.EmailAdd, email: EMAIL },
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
    it("removes and registers it again under the same code", async () => {
      const outcome = await runStep(
        { step: ContactChangeStep.EmailReverify, email: EMAIL },
        CODE,
      )

      expect(outcome).toEqual({ isDone: true })
      expect(mockEmailDelete).toHaveBeenCalledWith({
        variables: { input: { totpCode: CODE } },
        refetchQueries: [SettingsScreenDocument],
      })
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

      const outcome = await runStep(
        { step: ContactChangeStep.EmailReverify, email: EMAIL },
        CODE,
      )

      expect(mockSetParams).toHaveBeenCalledWith({
        step: ContactChangeStep.EmailAdd,
        email: EMAIL,
      })
      expect(outcome).toEqual({ isDone: false, refusal: CODE_INVALID })
    })

    it("registers nothing when the removal is refused", async () => {
      mockEmailDelete.mockResolvedValue(emailDeleted([CODE_INVALID]))

      const outcome = await runStep(
        { step: ContactChangeStep.EmailReverify, email: EMAIL },
        CODE,
      )

      expect(outcome).toEqual({ isDone: false, refusal: CODE_INVALID })
      expect(mockSetParams).not.toHaveBeenCalled()
      expect(mockEmailInitiate).not.toHaveBeenCalled()
    })
  })

  describe("removing the phone number", () => {
    it("removes it with the code and opens the flow that adds the new one", async () => {
      const outcome = await runStep({ step: ContactChangeStep.PhoneRemove }, CODE)

      expect(outcome).toEqual({ isDone: true })
      expect(mockPhoneDelete).toHaveBeenCalledWith({
        variables: { input: { totpCode: CODE } },
        refetchQueries: [SettingsScreenDocument],
      })
      expect(mockUpdateCurrentProfile).toHaveBeenCalledTimes(1)
      expect(mockReplace).toHaveBeenCalledWith("phoneRegistrationInitiate")
    })

    it("stays on the code when the server refuses it", async () => {
      mockPhoneDelete.mockResolvedValue(phoneDeleted([CODE_INVALID]))

      const outcome = await runStep({ step: ContactChangeStep.PhoneRemove }, CODE)

      expect(outcome).toEqual({ isDone: false, refusal: CODE_INVALID })
      expect(mockReplace).not.toHaveBeenCalled()
    })
  })

  describe("adding the phone number", () => {
    const params = {
      step: ContactChangeStep.PhoneAdd,
      phone: PHONE,
      smsCode: SMS_CODE,
    } as const

    it("confirms it with the SMS code and the authenticator's, then goes back to the settings", async () => {
      const outcome = await runStep(params, CODE)

      expect(outcome).toEqual({ isDone: true })
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

      const outcome = await runStep(params, CODE)

      expect(outcome).toEqual({ isDone: false, refusal: CODE_INVALID })
      expect(mockUpdateCurrentProfile).not.toHaveBeenCalled()
      expect(Alert.alert).not.toHaveBeenCalled()
    })
  })

  describe("a removal whose answer was lost", () => {
    it("goes on to add the email once the account reads it gone", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead({ email: null, phone: PHONE }))

      const outcome = await runStep({ step: ContactChangeStep.EmailRemove }, CODE)

      expect(outcome).toEqual({ isDone: true })
      expect(mockReplace).toHaveBeenCalledWith("emailRegistrationInitiate")
    })

    it("goes on to add the phone number once the account reads it gone", async () => {
      mockPhoneDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(
        accountRead({ email: { address: EMAIL }, phone: null }),
      )

      const outcome = await runStep({ step: ContactChangeStep.PhoneRemove }, CODE)

      expect(outcome).toEqual({ isDone: true })
      expect(mockReplace).toHaveBeenCalledWith("phoneRegistrationInitiate")
    })

    it("registers the email again once the account reads it gone", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead({ email: null, phone: PHONE }))

      const outcome = await runStep(
        { step: ContactChangeStep.EmailReverify, email: EMAIL },
        CODE,
      )

      expect(outcome).toEqual({ isDone: true })
      expect(mockEmailInitiate).toHaveBeenCalledTimes(1)
    })

    it("throws while the account still has the method", async () => {
      mockPhoneDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(
        accountRead({ email: { address: EMAIL }, phone: PHONE }),
      )

      await expect(
        runStep({ step: ContactChangeStep.PhoneRemove }, CODE),
      ).rejects.toThrow("network down")
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("throws when the account cannot be read", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockRejectedValue(new Error("still offline"))

      await expect(
        runStep({ step: ContactChangeStep.EmailRemove }, CODE),
      ).rejects.toThrow("network down")
    })

    /** A session switched meanwhile reads another account. */
    it("throws when the read is of another account", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue({ data: { me: { id: "2", email: null } } })

      await expect(
        runStep({ step: ContactChangeStep.EmailRemove }, CODE),
      ).rejects.toThrow("network down")
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("throws when the settings hold no account to compare the read with", async () => {
      mockAccountId = undefined
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead({ email: null, phone: PHONE }))

      await expect(
        runStep({ step: ContactChangeStep.EmailRemove }, CODE),
      ).rejects.toThrow("network down")
    })

    it("throws when the read answers with an error", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue({
        ...accountRead({ email: null, phone: PHONE }),
        error: new Error("still offline"),
      })

      await expect(
        runStep({ step: ContactChangeStep.EmailRemove }, CODE),
      ).rejects.toThrow("network down")
    })

    it("throws when the read answers with no account", async () => {
      mockEmailDelete.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue({ data: { me: null } })

      await expect(
        runStep({ step: ContactChangeStep.EmailRemove }, CODE),
      ).rejects.toThrow("network down")
    })
  })

  /** Only a lost answer may have landed: a failure the server sent back did not. */
  it("does not read the account after a failure that is not the network's", async () => {
    mockPhoneDelete.mockRejectedValue(new Error("network"))

    await expect(runStep({ step: ContactChangeStep.PhoneRemove }, CODE)).rejects.toThrow(
      "network",
    )
    expect(mockReadAccount).not.toHaveBeenCalled()
  })

  it("throws on a request that never answers", async () => {
    mockPhoneDelete.mockRejectedValue(new Error("network"))

    await expect(runStep({ step: ContactChangeStep.PhoneRemove }, CODE)).rejects.toThrow(
      "network",
    )
  })
})
