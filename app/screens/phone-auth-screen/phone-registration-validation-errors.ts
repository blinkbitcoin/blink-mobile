import { TranslationFunctions } from "@app/i18n/i18n-types"

/** Kept apart from the screen, so the code screen of a login method change can read
 *  the server's refusals without loading the phone screens and app-check with them. */
export const ValidatePhoneCodeErrors = {
  InvalidCode: "InvalidCode",
  TooManyAttempts: "TooManyAttempts",
  CannotUpgradeToExistingAccount: "CannotUpgradeToExistingAccount",
  IpNotAllowed: "IpNotAllowed",
  PhoneNotAllowed: "PhoneNotAllowed",
  UnknownError: "UnknownError",
} as const

export const mapGqlErrorsToValidatePhoneCodeErrors = (
  errors: readonly {
    code?: string | null | undefined
    message: string
  }[],
):
  | {
      type: ValidatePhoneCodeErrorsType
      msg?: string
    }
  | undefined => {
  if (errors.some((error) => error.code === "PHONE_CODE_ERROR")) {
    return {
      type: ValidatePhoneCodeErrors.InvalidCode,
    }
  }

  if (errors.some((error) => error.code === "TOO_MANY_REQUEST")) {
    return {
      type: ValidatePhoneCodeErrors.TooManyAttempts,
    }
  }

  if (errors.some((error) => error.code === "PHONE_NOT_ALLOWED_TO_ONBOARD_ERROR")) {
    return {
      type: ValidatePhoneCodeErrors.PhoneNotAllowed,
    }
  }

  if (errors.some((error) => error.code === "IP_NOT_ALLOWED_TO_ONBOARD_ERROR")) {
    return {
      type: ValidatePhoneCodeErrors.IpNotAllowed,
    }
  }

  if (
    errors.some(
      (error) =>
        error.code === "PHONE_ACCOUNT_ALREADY_EXISTS_ERROR" ||
        error.code === "PHONE_ACCOUNT_ALREADY_EXISTS_NEED_TO_SWEEP_FUNDS_ERROR",
    )
  ) {
    return {
      type: ValidatePhoneCodeErrors.CannotUpgradeToExistingAccount,
    }
  }

  if (errors.length > 0) {
    return {
      type: ValidatePhoneCodeErrors.UnknownError,
      msg: errors[0].message,
    }
  }

  return undefined
}

export const mapValidatePhoneCodeErrorsToMessage = (
  error: {
    type: ValidatePhoneCodeErrorsType
    msg?: string
  },
  LL: TranslationFunctions,
): string => {
  switch (error.type) {
    case ValidatePhoneCodeErrors.InvalidCode:
      return LL.PhoneLoginValidationScreen.errorLoggingIn()
    case ValidatePhoneCodeErrors.TooManyAttempts:
      return LL.PhoneLoginValidationScreen.errorTooManyAttempts()
    case ValidatePhoneCodeErrors.CannotUpgradeToExistingAccount:
      return LL.PhoneLoginValidationScreen.errorCannotUpgradeToExistingAccount()
    case ValidatePhoneCodeErrors.IpNotAllowed:
      return LL.PhoneLoginValidationScreen.errorIpNotAllowed()
    case ValidatePhoneCodeErrors.PhoneNotAllowed:
      return LL.PhoneLoginValidationScreen.errorPhoneNotAllowed()
    case ValidatePhoneCodeErrors.UnknownError:
    default:
      return LL.errors.generic() + (error.msg ? `: ${error.msg}` : "")
  }
}

export type ValidatePhoneCodeErrorsType =
  (typeof ValidatePhoneCodeErrors)[keyof typeof ValidatePhoneCodeErrors]
