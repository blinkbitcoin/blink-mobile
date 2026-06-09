const MIN_LENGTH_PATTERN = /.{12,}/s

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
