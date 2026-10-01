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
  /** The user's standing choice, kept apart from whether it currently applies:
   *  a password being edited into a transient invalid state must not quietly
   *  throw the opt-in away while the checkbox sits under the keyboard. Ongoing
   *  cloud sync is opt-in and off by default (D4), even though the seed is
   *  being uploaded to the same provider right here. */
  const [isAutoBundleSyncRequested, setIsAutoBundleSyncRequested] = useState(false)

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
    setIsAutoBundleSyncRequested((prev) => !prev)
  }, [])

  const toggleEncryption = useCallback(() => {
    setIsEncrypted((prev) => !prev)
    /** D9: the seed-encrypted bundle must never sit next to an unencrypted
     *  seed, so giving up the password gives up the sync with it. Deliberate,
     *  unlike a password merely being edited - this drops the choice itself. */
    setIsAutoBundleSyncRequested(false)
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

  /** Sync is only offered alongside a password-protected seed backup (D9). */
  const canSyncBundle = isValid && isEncrypted

  /** The D9 coupling in one place: the opt-in reads as on only while a
   *  password-protected seed backup is actually on offer. Derived rather than
   *  reset, so the row never renders checked inside a disabled control, and a
   *  password being retyped does not cost the user their choice. */
  const autoBundleSync = isAutoBundleSyncRequested && canSyncBundle

  const passwordError = shouldShowPasswordError
    ? LL.BackupScreen.CloudBackup.passwordTooShort()
    : undefined
  const confirmPasswordError = shouldShowConfirmPasswordError
    ? LL.BackupScreen.CloudBackup.passwordMismatch()
    : undefined

  return {
    isEncrypted,
    autoBundleSync,
    canSyncBundle,
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
