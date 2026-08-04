export const MIN_PASSWORD_LENGTH = 12

// The `s` flag lets newlines count toward the length, so multi-line
// passphrases are accepted.
const MIN_LENGTH_PATTERN = new RegExp(`.{${MIN_PASSWORD_LENGTH},}`, "s")

export type PasswordValidationResult = {
  valid: boolean
}

/** Validates a password against a policy regex, defaulting to the minimum-length rule. */
export const validatePassword = (
  password: string,
  pattern: RegExp = MIN_LENGTH_PATTERN,
): PasswordValidationResult => ({
  valid: pattern.test(password),
})
