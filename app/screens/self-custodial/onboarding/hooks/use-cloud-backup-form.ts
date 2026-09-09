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
  /** Ongoing cloud sync of the recovery backup: opt-in and off by default (D4),
   *  even though the seed is being uploaded to the same provider right here. */
  const [autoBundleSync, setAutoBundleSync] = useState(false)

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

  const toggleAutoBundleSync = useCallback(() => {
    setAutoBundleSync((prev) => !prev)
  }, [])

  const toggleEncryption = useCallback(() => {
    setIsEncrypted((prev) => {
      /** D9: the seed-encrypted recovery backup must never sit next to an
       *  unencrypted seed - the co-located seed would decrypt it on the spot.
       *  Dropping the password therefore drops bundle sync with it, rather
       *  than leaving a checked box that silently would not apply. */
      if (prev) setAutoBundleSync(false)
      return !prev
    })
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
    autoBundleSync,
    /** Sync is only offered alongside a password-protected seed backup (D9). */
    canSyncBundle: isValid && isEncrypted,
    toggleAutoBundleSync,
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
