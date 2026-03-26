import { useCallback, useMemo, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { useI18nContext } from "@app/i18n/i18n-react"

const MIN_PASSWORD_LENGTH = 12

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

  const passwordError = useMemo(() => {
    if (!isEncrypted) return undefined
    if (password.length === 0) return undefined
    if (password.length < MIN_PASSWORD_LENGTH)
      return LL.SparkOnboarding.CloudBackup.passwordTooShort()
    return undefined
  }, [isEncrypted, password, LL])

  const confirmPasswordError = useMemo(() => {
    if (!isEncrypted) return undefined
    if (confirmPassword.length === 0) return undefined
    if (confirmPassword !== password)
      return LL.SparkOnboarding.CloudBackup.passwordMismatch()
    return undefined
  }, [isEncrypted, confirmPassword, password, LL])

  const isValid = useMemo(() => {
    if (!isEncrypted) return true
    if (password.length < MIN_PASSWORD_LENGTH) return false
    if (confirmPassword !== password) return false
    return true
  }, [isEncrypted, password, confirmPassword])

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
