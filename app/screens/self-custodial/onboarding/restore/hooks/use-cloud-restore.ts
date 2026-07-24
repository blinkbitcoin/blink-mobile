import { useCallback, useEffect, useRef, useState } from "react"

import { getCloudBackupFilenamePrefix } from "@app/config/appinfo"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { CloudBackupErrorReason } from "@app/types/cloud-backup"
import {
  type BackupMetadata,
  BackupPayloadError,
  BackupPayloadErrorReason,
  isEncryptedBackup,
  parseBackupMetadata,
  parseBackupPayload,
  parseEncryptedBackupPayload,
} from "@app/utils/backup-payload"
import { reportError } from "@app/utils/error-logging"

import { usePlatformCloudBackup } from "../../hooks/use-platform-cloud-backup"

import { RestoreWalletStatus, useRestoreWallet } from "./use-restore-wallet"

const CloudStep = {
  Loading: "loading",
  NotFound: "not-found",
  Picker: "picker",
  Password: "password",
  Error: "error",
} as const

type CloudStep = (typeof CloudStep)[keyof typeof CloudStep]

const STEP_FOR_REASON: Readonly<Record<CloudBackupErrorReason, CloudStep>> = {
  [CloudBackupErrorReason.NotFound]: CloudStep.NotFound,
  [CloudBackupErrorReason.Auth]: CloudStep.Error,
  [CloudBackupErrorReason.PermissionDenied]: CloudStep.Error,
  [CloudBackupErrorReason.Transient]: CloudStep.Error,
  [CloudBackupErrorReason.Unknown]: CloudStep.Error,
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
  CloudDownload: "Cloud download",
  PerFileDownload: "Per-file download",
  Decrypt: "Backup decrypt",
} as const

type RestoreErrorContext = (typeof RestoreErrorContext)[keyof typeof RestoreErrorContext]

export const useCloudRestore = () => {
  const { LL } = useI18nContext()
  const { appConfig } = useAppConfig()
  const { listBackups, downloadById, loading: cloudLoading } = usePlatformCloudBackup()
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
        reportError(
          RestoreErrorContext.CloudDownload,
          new Error("Access token unavailable when picking backup entry"),
        )
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
        reportError(RestoreErrorContext.CloudDownload, err)
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
      const prefix = getCloudBackupFilenamePrefix(appConfig.galoyInstance.name)
      const listResult = await listBackups(prefix)
      if (!listResult.success) {
        setStep(STEP_FOR_REASON[listResult.reason])
        return
      }

      const { entries: files, accessToken: token } = listResult
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
              return result.reason === CloudBackupErrorReason.NotFound
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
            reportError(RestoreErrorContext.PerFileDownload, err)
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
      reportError(RestoreErrorContext.CloudDownload, err)
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

    let mnemonic: string
    try {
      mnemonic = parseEncryptedBackupPayload(backupContent, password).mnemonic
    } catch (err) {
      if (
        err instanceof BackupPayloadError &&
        err.reason === BackupPayloadErrorReason.WrongPassword
      ) {
        setPasswordError(LL.RestoreScreen.wrongPassword())
        return
      }
      reportError(RestoreErrorContext.Decrypt, err)
      setStep(CloudStep.Error)
      return
    }

    await restore(mnemonic).catch(() => undefined)
  }, [backupContent, password, restore, LL])

  const isLoading =
    step === CloudStep.Loading ||
    restoreStatus === RestoreWalletStatus.Restoring ||
    cloudLoading

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
