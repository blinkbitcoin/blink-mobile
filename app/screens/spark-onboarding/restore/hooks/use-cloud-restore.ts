import { useCallback, useEffect, useRef, useState } from "react"

import crashlytics from "@react-native-firebase/crashlytics"

import { getSparkDriveBackupFilename } from "@app/config/appinfo"
import { useAppConfig, useGoogleDriveBackup } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  isEncryptedBackup,
  parseBackupPayload,
  parseEncryptedBackupPayload,
} from "@app/utils/spark-backup-format"

import { RestoreWalletStatus, useRestoreWallet } from "./use-restore-wallet"

const CloudStep = {
  Loading: "loading",
  NotFound: "not-found",
  Password: "password",
  Error: "error",
} as const

type CloudStep = (typeof CloudStep)[keyof typeof CloudStep]

export const useCloudRestore = () => {
  const { LL } = useI18nContext()
  const { appConfig } = useAppConfig()
  const { startSession, download, loading: driveLoading } = useGoogleDriveBackup()
  const { restore, status: restoreStatus } = useRestoreWallet()

  const [step, setStep] = useState<CloudStep>(CloudStep.Loading)
  const [backupContent, setBackupContent] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const hasRunRef = useRef(false)

  const attemptDownload = useCallback(async () => {
    setStep(CloudStep.Loading)
    try {
      const filename = getSparkDriveBackupFilename(appConfig.galoyInstance.name)
      const session = await startSession(filename)
      const result = await download(session)

      if (!result.success) {
        setStep(CloudStep.NotFound)
        return
      }

      if (isEncryptedBackup(result.content)) {
        setBackupContent(result.content)
        setStep(CloudStep.Password)
        return
      }

      const { mnemonic } = parseBackupPayload(result.content)
      await restore(mnemonic)
    } catch (err) {
      crashlytics().recordError(
        err instanceof Error ? err : new Error(`Cloud download failed: ${err}`),
      )
      setStep(CloudStep.Error)
    }
  }, [appConfig.galoyInstance.name, startSession, download, restore])

  useEffect(() => {
    if (hasRunRef.current) return
    hasRunRef.current = true
    attemptDownload()
  }, [attemptDownload])

  const handleDecrypt = useCallback(async () => {
    if (!backupContent) return
    setPasswordError(null)

    try {
      const { mnemonic } = parseEncryptedBackupPayload(backupContent, password)
      await restore(mnemonic)
    } catch {
      setPasswordError(LL.RestoreScreen.wrongPassword())
    }
  }, [backupContent, password, restore, LL])

  const isLoading =
    step === CloudStep.Loading ||
    restoreStatus === RestoreWalletStatus.Restoring ||
    driveLoading

  const hasError = step === CloudStep.Error || restoreStatus === RestoreWalletStatus.Error

  return {
    step,
    isLoading,
    hasError,
    isNotFound: step === CloudStep.NotFound,
    isPassword: step === CloudStep.Password,
    password,
    setPassword,
    passwordError,
    attemptDownload,
    handleDecrypt,
  }
}
