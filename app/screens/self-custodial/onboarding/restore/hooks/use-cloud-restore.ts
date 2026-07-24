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
  | { kind: "failure"; reason: CloudBackupErrorReason }

const RestoreErrorContext = {
  CloudDownload: "Cloud download",
  PerFileDownload: "Per-file download",
  Decrypt: "Backup decrypt",
} as const

type RestoreErrorContext = (typeof RestoreErrorContext)[keyof typeof RestoreErrorContext]

export const useCloudRestore = () => {
  const { LL } = useI18nContext()
  const { appConfig } = useAppConfig()
  const {
    listBackups,
    downloadById,
    resolveErrorMessage,
    loading: cloudLoading,
  } = usePlatformCloudBackup()
  const { restore, status: restoreStatus } = useRestoreWallet()

  const [step, setStep] = useState<CloudStep>(CloudStep.Loading)
  const [entries, setEntries] = useState<ReadonlyArray<CloudBackupEntry>>([])
  const [backupContent, setBackupContent] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const hasRunRef = useRef(false)

  /** A missing backup is its own step with its own copy, so only a real failure carries a
   *  message. */
  const showFailure = useCallback(
    (reason: CloudBackupErrorReason) => {
      const nextStep = STEP_FOR_REASON[reason]
      const isErrorStep = nextStep === CloudStep.Error
      setErrorMessage(isErrorStep ? resolveErrorMessage(reason, LL) : null)
      setStep(nextStep)
    },
    [resolveErrorMessage, LL],
  )

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
      setErrorMessage(null)
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
          showFailure(result.reason)
          return
        }
        await proceedWithBackup(result.content)
      } catch (err) {
        reportError(RestoreErrorContext.CloudDownload, err)
        setStep(CloudStep.Error)
      }
    },
    [downloadById, proceedWithBackup, showFailure],
  )

  const loadCloudBackups = useCallback(async () => {
    setStep(CloudStep.Loading)
    setPassword("")
    setPasswordError(null)
    setBackupContent(null)
    setErrorMessage(null)

    try {
      const prefix = getCloudBackupFilenamePrefix(appConfig.galoyInstance.name)
      const listResult = await listBackups(prefix)
      if (!listResult.success) {
        showFailure(listResult.reason)
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
          showFailure(result.reason)
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
                : { kind: "failure", reason: result.reason }
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
            return { kind: "failure", reason: CloudBackupErrorReason.Unknown }
          }
        }),
      )

      const downloaded = outcomes.flatMap((o) => (o.kind === "success" ? [o.backup] : []))
      const failureReasons = outcomes.flatMap((o) =>
        o.kind === "failure" ? [o.reason] : [],
      )

      if (downloaded.length === 0) {
        const [firstFailureReason] = failureReasons
        if (firstFailureReason) {
          showFailure(firstFailureReason)
          return
        }
        setStep(CloudStep.NotFound)
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
  }, [
    appConfig.galoyInstance.name,
    listBackups,
    downloadById,
    proceedWithBackup,
    showFailure,
  ])

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
    errorMessage,
    loadCloudBackups,
    handlePick,
    handleDecrypt,
  }
}
