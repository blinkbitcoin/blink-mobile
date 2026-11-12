import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import {
  mapGqlErrorsToValidatePhoneCodeErrors,
  mapValidatePhoneCodeErrorsToMessage,
  ValidatePhoneCodeErrors,
} from "@app/screens/phone-auth-screen/phone-registration-validation-errors"

loadLocale("en")
const LL = i18nObject("en")

const refusal = (code: string, message = "refused") => [{ code, message }]

describe("mapGqlErrorsToValidatePhoneCodeErrors", () => {
  const cases = [
    ["PHONE_CODE_ERROR", ValidatePhoneCodeErrors.InvalidCode],
    ["TOO_MANY_REQUEST", ValidatePhoneCodeErrors.TooManyAttempts],
    ["PHONE_NOT_ALLOWED_TO_ONBOARD_ERROR", ValidatePhoneCodeErrors.PhoneNotAllowed],
    ["IP_NOT_ALLOWED_TO_ONBOARD_ERROR", ValidatePhoneCodeErrors.IpNotAllowed],
    [
      "PHONE_ACCOUNT_ALREADY_EXISTS_ERROR",
      ValidatePhoneCodeErrors.CannotUpgradeToExistingAccount,
    ],
    [
      "PHONE_ACCOUNT_ALREADY_EXISTS_NEED_TO_SWEEP_FUNDS_ERROR",
      ValidatePhoneCodeErrors.CannotUpgradeToExistingAccount,
    ],
  ] as const

  for (const [code, type] of cases) {
    it(`reads ${code} as ${type}`, () => {
      expect(mapGqlErrorsToValidatePhoneCodeErrors(refusal(code))).toEqual({ type })
    })
  }

  it("keeps the server's words for a refusal it does not know", () => {
    expect(mapGqlErrorsToValidatePhoneCodeErrors(refusal("OTHER", "Nope"))).toEqual({
      type: ValidatePhoneCodeErrors.UnknownError,
      msg: "Nope",
    })
  })

  it("is nothing when the server refused nothing", () => {
    expect(mapGqlErrorsToValidatePhoneCodeErrors([])).toBeUndefined()
  })
})

describe("mapValidatePhoneCodeErrorsToMessage", () => {
  const cases = [
    [ValidatePhoneCodeErrors.InvalidCode, LL.PhoneLoginValidationScreen.errorLoggingIn()],
    [
      ValidatePhoneCodeErrors.TooManyAttempts,
      LL.PhoneLoginValidationScreen.errorTooManyAttempts(),
    ],
    [
      ValidatePhoneCodeErrors.CannotUpgradeToExistingAccount,
      LL.PhoneLoginValidationScreen.errorCannotUpgradeToExistingAccount(),
    ],
    [
      ValidatePhoneCodeErrors.IpNotAllowed,
      LL.PhoneLoginValidationScreen.errorIpNotAllowed(),
    ],
    [
      ValidatePhoneCodeErrors.PhoneNotAllowed,
      LL.PhoneLoginValidationScreen.errorPhoneNotAllowed(),
    ],
  ] as const

  for (const [type, message] of cases) {
    it(`says ${type}`, () => {
      expect(mapValidatePhoneCodeErrorsToMessage({ type }, LL)).toBe(message)
    })
  }

  it("adds the server's words to the generic message", () => {
    expect(
      mapValidatePhoneCodeErrorsToMessage(
        { type: ValidatePhoneCodeErrors.UnknownError, msg: "Nope" },
        LL,
      ),
    ).toBe(`${LL.errors.generic()}: Nope`)
  })

  it("says the generic message alone without them", () => {
    expect(
      mapValidatePhoneCodeErrorsToMessage(
        { type: ValidatePhoneCodeErrors.UnknownError },
        LL,
      ),
    ).toBe(LL.errors.generic())
  })
})
