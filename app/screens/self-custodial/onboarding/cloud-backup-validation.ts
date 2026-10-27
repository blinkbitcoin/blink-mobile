import { validatePassword } from "@app/utils/validators/password"

type CloudBackupFormInput = {
  password: string
  confirmPassword: string
  passwordTouched: boolean
  confirmPasswordTouched: boolean
}

export type CloudBackupFormValidation = {
  shouldShowPasswordError: boolean
  shouldShowConfirmPasswordError: boolean
  isValid: boolean
}

/** Every cloud seed backup carries a passphrase: automatic bundle backups are
 *  always on, and the seed-encrypted bundle must never sit next to an
 *  unencrypted seed (D9). */
export const validateCloudBackupForm = ({
  password,
  confirmPassword,
  passwordTouched,
  confirmPasswordTouched,
}: CloudBackupFormInput): CloudBackupFormValidation => {
  const hasPassword = password.length > 0
  const hasConfirmPassword = confirmPassword.length > 0
  const isPasswordValid = validatePassword(password).valid
  const doPasswordsMatch = password === confirmPassword

  return {
    shouldShowPasswordError: passwordTouched && hasPassword && !isPasswordValid,
    shouldShowConfirmPasswordError:
      confirmPasswordTouched && hasConfirmPassword && !doPasswordsMatch,
    isValid: isPasswordValid && doPasswordsMatch,
  }
}
