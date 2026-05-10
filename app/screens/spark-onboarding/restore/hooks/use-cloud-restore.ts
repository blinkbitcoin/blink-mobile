import { useCallback, useEffect, useRef, useState } from "react"

import crashlytics from "@react-native-firebase/crashlytics"

import { getSparkDriveBackupFilenamePrefix } from "@app/config/appinfo"
import { useAppConfig, useGoogleDriveBackup } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  type BackupMetadata,
  isEncryptedBackup,
  parseBackupMetadata,
  parseBackupPayload,
  parseEncryptedBackupPayload,
} from "@app/utils/backup-payload"
import { DriveErrorReason } from "@app/utils/google-drive-client"

import { RestoreWalletStatus, useRestoreWallet } from "./use-restore-wallet"

const CloudStep = {
  Loading: "loading",
  NotFound: "not-found",
  Picker: "picker",
  Password: "password",
  Error: "error",
} as const

type CloudStep = (typeof CloudStep)[keyof typeof CloudStep]

const STEP_FOR_REASON: Readonly<Record<DriveErrorReason, CloudStep>> = {
  [DriveErrorReason.NotFound]: CloudStep.NotFound,
  [DriveErrorReason.Auth]: CloudStep.Error,
  [DriveErrorReason.Transient]: CloudStep.Error,
  [DriveErrorReason.Unknown]: CloudStep.Error,
}

export type CloudBackupEntry = {
  fileId: string
  metadata: BackupMetadata
}

type DownloadedBackup = { entry: CloudBackupEntry; content: string }

type FileOutcome =
  | { kind: "success"; backup: DownloadedBackup }
  | { kind: "not-found" }
  | { kind: "failure" }

const RestoreErrorContext = {
  CloudDownload: "Cloud download failed",
  PerFileDownload: "Per-file download failed",
} as const

type RestoreErrorContext = (typeof RestoreErrorContext)[keyof typeof RestoreErrorContext]

const reportRestoreError = (context: RestoreErrorContext, err: unknown): void => {
  crashlytics().recordError(err instanceof Error ? err : new Error(`${context}: ${err}`))
}

export const useCloudRestore = () => {
  const { LL } = useI18nContext()
  const { appConfig } = useAppConfig()
  const { listBackups, downloadById, loading: driveLoading } = useGoogleDriveBackup()
  const { restore, status: restoreStatus } = useRestoreWallet()

  const [step, setStep] = useState<CloudStep>(CloudStep.Loading)
  const [entries, setEntries] = useState<ReadonlyArray<CloudBackupEntry>>([])
  const [backupContent, setBackupContent] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const hasRunRef = useRef(false)

  const proceedWithBackup = useCallback(
    async (content: string) => {
      if (isEncryptedBackup(content)) {
        setBackupContent(content)
        setStep(CloudStep.Password)
        return
      }
      const { mnemonic } = parseBackupPayload(content)
      await restore(mnemonic)
    },
    [restore],
  )

  const handlePick = useCallback(
    async (entry: CloudBackupEntry) => {
      const accessToken = accessTokenRef.current
      if (!accessToken) {
        setStep(CloudStep.Error)
        return
      }
      setStep(CloudStep.Loading)
      try {
        const result = await downloadById(entry.fileId, accessToken)
        if (!result.success) {
          setStep(STEP_FOR_REASON[result.reason])
          return
        }
        await proceedWithBackup(result.content)
      } catch (err) {
        reportRestoreError(RestoreErrorContext.CloudDownload, err)
        setStep(CloudStep.Error)
      }
    },
    [downloadById, proceedWithBackup],
  )

  const loadCloudBackups = useCallback(async () => {
    setStep(CloudStep.Loading)
    setPassword("")
    setPasswordError(null)
    setBackupContent(null)

    try {
      const prefix = getSparkDriveBackupFilenamePrefix(appConfig.galoyInstance.name)
      const { entries: files, accessToken: token } = await listBackups(prefix)

      accessTokenRef.current = token

      if (files.length === 0) {
        setStep(CloudStep.NotFound)
        return
      }

      if (files.length === 1) {
        const result = await downloadById(files[0].id, token)
        if (!result.success) {
          setStep(STEP_FOR_REASON[result.reason])
          return
        }
        if (!parseBackupMetadata(result.content)) {
          setStep(CloudStep.NotFound)
          return
        }
        await proceedWithBackup(result.content)
        return
      }

      const outcomes: ReadonlyArray<FileOutcome> = await Promise.all(
        files.map(async (file): Promise<FileOutcome> => {
          try {
            const result = await downloadById(file.id, token)
            if (!result.success) {
              return result.reason === DriveErrorReason.NotFound
                ? { kind: "not-found" }
                : { kind: "failure" }
            }
            const metadata = parseBackupMetadata(result.content)
            if (!metadata) return { kind: "not-found" }
            return {
              kind: "success",
              backup: {
                entry: { fileId: file.id, metadata },
                content: result.content,
              },
            }
          } catch (err) {
            reportRestoreError(RestoreErrorContext.PerFileDownload, err)
            return { kind: "failure" }
          }
        }),
      )

      const downloaded = outcomes.flatMap((o) => (o.kind === "success" ? [o.backup] : []))
      const hasNonNotFoundFailure = outcomes.some((o) => o.kind === "failure")

      if (downloaded.length === 0) {
        setStep(hasNonNotFoundFailure ? CloudStep.Error : CloudStep.NotFound)
        return
      }

      if (downloaded.length === 1) {
        await proceedWithBackup(downloaded[0].content)
        return
      }

      setEntries(downloaded.map((item) => item.entry))
      setStep(CloudStep.Picker)
    } catch (err) {
      reportRestoreError(RestoreErrorContext.CloudDownload, err)
      setStep(CloudStep.Error)
    }
  }, [appConfig.galoyInstance.name, listBackups, downloadById, proceedWithBackup])

  useEffect(() => {
    if (hasRunRef.current) return
    hasRunRef.current = true
    loadCloudBackups()
  }, [loadCloudBackups])

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
    isPicker: step === CloudStep.Picker,
    isPassword: step === CloudStep.Password,
    entries,
    password,
    setPassword,
    passwordError,
    loadCloudBackups,
    handlePick,
    handleDecrypt,
  }
}
