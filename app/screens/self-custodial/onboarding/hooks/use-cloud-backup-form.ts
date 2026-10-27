import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { readRecoveryBundleSettings } from "@app/self-custodial/recovery-bundle/settings"
import { reportError } from "@app/utils/error-logging"

import { validateCloudBackupForm } from "../cloud-backup-validation"

import { useBackupAccountId } from "./use-wallet-mnemonic"

export const useCloudBackupForm = () => {
  const { LL } = useI18nContext()
  const backupAccountId = useBackupAccountId()
  const [isEncrypted, setIsEncrypted] = useState(false)
  /** Mirrors isEncrypted synchronously, so two taps before a re-render still
   *  toggle twice and the second one sees the first. */
  const isEncryptedRef = useRef(false)
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
  /** Whether the opt-in reflects a choice worth storing: the one already saved for
   *  this account, or one the user just made. Until then a backup leaves the stored
   *  choice alone, so a setting that could not be read never passes for an opt-out. */
  const [isAutoBundleSyncKnown, setIsAutoBundleSyncKnown] = useState(false)
  const [isAutoBundleSyncLoading, setIsAutoBundleSyncLoading] = useState(true)

  /** Starts from the stored choice, so a user who opted in before sees it on again
   *  instead of an unchecked box while the sync keeps running. */
  useEffect(() => {
    /** A new account starts unknown and locked until its own choice is read: the
     *  migration account can arrive after the first render, and a read landing
     *  late must not overwrite a choice the user made in the meantime. */
    setIsAutoBundleSyncKnown(false)
    setIsAutoBundleSyncLoading(backupAccountId !== null)
    if (!backupAccountId) return undefined
    let isCurrent = true
    readRecoveryBundleSettings(backupAccountId)
      .then((settings) => {
        if (!isCurrent) return
        setIsAutoBundleSyncRequested(settings.cloudSync)
        setIsAutoBundleSyncKnown(true)
      })
      .catch((err) => reportError("Recovery bundle settings read", err))
      .finally(() => {
        if (isCurrent) setIsAutoBundleSyncLoading(false)
      })
    return () => {
      isCurrent = false
    }
  }, [backupAccountId])

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
    setIsAutoBundleSyncKnown(true)
  }, [])

  const toggleEncryption = useCallback(() => {
    const wasEncrypted = isEncryptedRef.current
    isEncryptedRef.current = !wasEncrypted
    setIsEncrypted(!wasEncrypted)
    /** D9: the seed-encrypted bundle must never sit next to an unencrypted
     *  seed, so giving up the password gives up the sync with it. Deliberate,
     *  unlike a password merely being edited - this drops the choice itself.
     *  Turning encryption on keeps it: that is the step a stored opt-in needs. */
    if (wasEncrypted) setIsAutoBundleSyncRequested(false)
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
    isAutoBundleSyncKnown,
    isAutoBundleSyncLoading,
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
