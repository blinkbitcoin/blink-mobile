import { useCallback, useMemo, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { validatePassword, PasswordIssue } from "@app/utils/validators/password"

export const useCloudBackupForm = () => {
  const { LL } = useI18nContext()
  const [isEncrypted, setIsEncrypted] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useFocusEffect(
    useCallback(() => {
      return () => {
        setPassword("")
        setConfirmPassword("")
      }
    }, []),
  )

  const toggleEncryption = useCallback(() => {
    setIsEncrypted((prev) => !prev)
    setPassword("")
    setConfirmPassword("")
  }, [])

  const passwordValidation = useMemo(() => {
    if (!isEncrypted || password.length === 0) return null
    return validatePassword(password)
  }, [isEncrypted, password])

  const passwordError = useMemo(() => {
    if (!passwordValidation) return undefined
    if (passwordValidation.valid) return undefined
    if (passwordValidation.errors.includes(PasswordIssue.TooShort))
      return LL.BackupScreen.CloudBackup.passwordTooShort()
    if (passwordValidation.errors.includes(PasswordIssue.CommonPassword))
      return LL.common.passwordCommon()
    if (passwordValidation.errors.includes(PasswordIssue.TooWeak))
      return LL.common.passwordTooWeak()
    return undefined
  }, [passwordValidation, LL])

  const confirmPasswordError = useMemo(() => {
    if (!isEncrypted) return undefined
    if (confirmPassword.length === 0) return undefined
    if (confirmPassword !== password)
      return LL.BackupScreen.CloudBackup.passwordMismatch()
    return undefined
  }, [isEncrypted, confirmPassword, password, LL])

  const isValid = useMemo(() => {
    if (!isEncrypted) return true
    if (!passwordValidation?.valid) return false
    if (confirmPassword !== password) return false
    return true
  }, [isEncrypted, password, confirmPassword, passwordValidation])

  return {
    isEncrypted,
    password,
    confirmPassword,
    toggleEncryption,
    setPassword,
    setConfirmPassword,
    passwordError,
    confirmPasswordError,
    isValid,
  }
}
