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

/** Every new cloud seed backup carries a passphrase: the emergency bundle
 *  follows the seed to the cloud, encrypted with that same seed, so the
 *  passphrase is what protects both. */
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
