import { renderHook } from "@testing-library/react-native"

import { usePhoneAddition } from "@app/custodial/hooks/use-phone-addition"

const PHONE = "+50760000000"
const SMS_CODE = "000000"
const TOTP_CODE = "123456"

const mockLogAddPhoneAttempt = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logAddPhoneAttempt: () => mockLogAddPhoneAttempt(),
}))

const mockPhoneValidate = jest.fn()
const mockReadAccount = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserPhoneRegistrationValidateMutation: () => [mockPhoneValidate],
  useSettingsScreenLazyQuery: () => [mockReadAccount],
  useSettingsScreenQuery: () => ({ data: { me: { id: "1" } } }),
}))

const REFUSAL = { code: "TOTP_CODE_INVALID", message: "Invalid code" }

const phoneValidated = (errors: unknown[] = []) => ({
  data: { userPhoneRegistrationValidate: { errors } },
})

/** A request that may have reached the server, with no answer back. */
const lostAnswer = () =>
  Object.assign(new Error("network down"), { networkError: new Error("offline") })

/** The account as the server reads it back. */
const accountRead = (phone: string | null, id = "1") => ({
  data: { me: { id, phone } },
})

const addPhone = () => {
  const { result } = renderHook(() => usePhoneAddition())
  return result.current.add({ phone: PHONE, smsCode: SMS_CODE, totpCode: TOTP_CODE })
}

describe("usePhoneAddition", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPhoneValidate.mockResolvedValue(phoneValidated())
  })

  it("adds the number with the SMS code and the authenticator's", async () => {
    expect(await addPhone()).toBeUndefined()
    expect(mockLogAddPhoneAttempt).toHaveBeenCalledTimes(1)
    expect(mockPhoneValidate).toHaveBeenCalledWith({
      variables: { input: { phone: PHONE, code: SMS_CODE, totpCode: TOTP_CODE } },
    })
    expect(mockReadAccount).not.toHaveBeenCalled()
  })

  it("hands back the server's refusal", async () => {
    mockPhoneValidate.mockResolvedValue(phoneValidated([REFUSAL]))

    expect(await addPhone()).toEqual(REFUSAL)
    expect(mockReadAccount).not.toHaveBeenCalled()
  })

  describe("an addition whose answer was lost", () => {
    it("counts as added once the account reads the number on it", async () => {
      mockPhoneValidate.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead(PHONE))

      expect(await addPhone()).toBeUndefined()
      expect(mockPhoneValidate).toHaveBeenCalledTimes(1)
    })

    it("throws while the account has no number", async () => {
      mockPhoneValidate.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead(null))

      await expect(addPhone()).rejects.toThrow("network down")
    })

    it("throws while the account has another number", async () => {
      mockPhoneValidate.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead("+50761111111"))

      await expect(addPhone()).rejects.toThrow("network down")
    })

    /** A session switched meanwhile reads another account, which may have the number
     *  for its own reasons. */
    it("throws when the read is of another account", async () => {
      mockPhoneValidate.mockRejectedValue(lostAnswer())
      mockReadAccount.mockResolvedValue(accountRead(PHONE, "2"))

      await expect(addPhone()).rejects.toThrow("network down")
    })
  })

  /** Only a lost answer may have landed: a failure the server sent back did not. */
  it("reads nothing after a failure that is not the network's", async () => {
    mockPhoneValidate.mockRejectedValue(new Error("network"))

    await expect(addPhone()).rejects.toThrow("network")
    expect(mockReadAccount).not.toHaveBeenCalled()
  })
})
