import { useCallback, useEffect, useMemo, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { useI18nContext } from "@app/i18n/i18n-react"

import { validateCloudBackupForm } from "../cloud-backup-validation"

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
    if (!password) setPasswordTouched(false)
  }, [password])

  useEffect(() => {
    if (!confirmPassword) setConfirmPasswordTouched(false)
  }, [confirmPassword])

  const { shouldShowPasswordError, shouldShowConfirmPasswordError, isValid } = useMemo(
    () =>
      validateCloudBackupForm({
        isEncrypted,
        password,
        confirmPassword,
        passwordTouched,
        confirmPasswordTouched,
      }),
    [isEncrypted, password, confirmPassword, passwordTouched, confirmPasswordTouched],
  )

  const passwordError = shouldShowPasswordError
    ? LL.BackupScreen.CloudBackup.passwordTooShort()
    : undefined
  const confirmPasswordError = shouldShowConfirmPasswordError
    ? LL.BackupScreen.CloudBackup.passwordMismatch()
    : undefined

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
