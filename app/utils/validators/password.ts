export const MIN_PASSWORD_LENGTH = 12

export type PasswordValidationResult = {
  valid: boolean
}

/** Validates a password against the policy: a minimum length, nothing more. */
export const validatePassword = (password: string): PasswordValidationResult => ({
  valid: password.length >= MIN_PASSWORD_LENGTH,
})
