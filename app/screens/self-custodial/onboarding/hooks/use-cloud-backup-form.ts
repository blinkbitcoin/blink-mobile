import { useCallback, useEffect, useMemo, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { validatePassword, PasswordIssue } from "@app/utils/validators/password"

export const useCloudBackupForm = () => {
  const { LL } = useI18nContext()
  const [isEncrypted, setIsEncrypted] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false)

  useFocusEffect(
    useCallback(() => {
      return () => {
        setPassword("")
        setConfirmPassword("")
        setPasswordTouched(false)
        setConfirmPasswordTouched(false)
      }
    }, []),
  )

  const toggleEncryption = useCallback(() => {
    setIsEncrypted((prev) => !prev)
    setPassword("")
    setConfirmPassword("")
    setPasswordTouched(false)
    setConfirmPasswordTouched(false)
  }, [])

  const markPasswordTouched = useCallback(() => {
    setPasswordTouched(true)
  }, [])

  const markConfirmPasswordTouched = useCallback(() => {
    setConfirmPasswordTouched(true)
  }, [])

  useEffect(() => {
    if (password.length === 0) setPasswordTouched(false)
  }, [password])

  useEffect(() => {
    if (confirmPassword.length === 0) setConfirmPasswordTouched(false)
  }, [confirmPassword])

  const passwordValidation = useMemo(() => {
    if (!isEncrypted || password.length === 0) return null
    return validatePassword(password)
  }, [isEncrypted, password])

  const passwordError = useMemo(() => {
    if (!passwordTouched || !passwordValidation || passwordValidation.valid) {
      return undefined
    }
    const { errors } = passwordValidation
    if (errors.includes(PasswordIssue.TooShort))
      return LL.BackupScreen.CloudBackup.passwordTooShort()
    if (errors.includes(PasswordIssue.CommonPassword)) return LL.common.passwordCommon()
    if (errors.includes(PasswordIssue.TooWeak)) return LL.common.passwordTooWeak()
    return undefined
  }, [passwordTouched, passwordValidation, LL])

  const confirmPasswordError = useMemo(() => {
    if (!confirmPasswordTouched || !isEncrypted || confirmPassword.length === 0) {
      return undefined
    }
    if (confirmPassword !== password)
      return LL.BackupScreen.CloudBackup.passwordMismatch()
    return undefined
  }, [confirmPasswordTouched, isEncrypted, confirmPassword, password, LL])

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
    markPasswordTouched,
    markConfirmPasswordTouched,
    passwordError,
    confirmPasswordError,
    isValid,
  }
}
