import { useCallback, useEffect, useMemo, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { validatePassword } from "@app/utils/validators/password"

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

  const isPasswordValid = useMemo(() => validatePassword(password).valid, [password])

  const passwordError = useMemo(() => {
    if (!passwordTouched || !isEncrypted || password.length === 0 || isPasswordValid) {
      return undefined
    }
    return LL.BackupScreen.CloudBackup.passwordTooShort()
  }, [passwordTouched, isEncrypted, password, isPasswordValid, LL])

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
    if (!isPasswordValid) return false
    if (confirmPassword !== password) return false
    return true
  }, [isEncrypted, password, confirmPassword, isPasswordValid])

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
