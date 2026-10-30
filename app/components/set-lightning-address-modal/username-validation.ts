export const SetUsernameError = {
  TOO_SHORT: "TOO_SHORT",
  TOO_LONG: "TOO_LONG",
  INVALID_CHARACTER: "INVALID_CHARACTER",
  ADDRESS_UNAVAILABLE: "ADDRESS_UNAVAILABLE",
  /** The address server could not be reached. Distinct from ADDRESS_UNAVAILABLE, which
   *  says the name is taken: telling a user their chosen name is gone when the server
   *  merely did not answer sends them off to pick a different one for nothing. */
  SERVER_UNREACHABLE: "SERVER_UNREACHABLE",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  BACKUP_REQUIRED: "BACKUP_REQUIRED",
} as const

const UsernameRegex = /^(?![13_]|bc1|lnbc1)(?=.*[a-z])[0-9a-z_]{3,50}$/i

export type SetUsernameError = (typeof SetUsernameError)[keyof typeof SetUsernameError]

type ValidateUsernameResult = { valid: true } | { valid: false; error: SetUsernameError }

export const validateUsername = (username: string): ValidateUsernameResult => {
  if (username.length < 3) {
    return {
      valid: false,
      error: SetUsernameError.TOO_SHORT,
    }
  }

  if (username.length > 50) {
    return {
      valid: false,
      error: SetUsernameError.TOO_LONG,
    }
  }

  if (!UsernameRegex.test(username)) {
    return {
      valid: false,
      error: SetUsernameError.INVALID_CHARACTER,
    }
  }

  return { valid: true }
}
