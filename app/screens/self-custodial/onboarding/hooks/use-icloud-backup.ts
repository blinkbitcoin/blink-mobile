import { useCallback, useState } from "react"

import crashlytics from "@react-native-firebase/crashlytics"

import {
  CloudBackupDownloadResult,
  CloudBackupErrorMessageResolver,
  CloudBackupErrorReason,
  CloudBackupListResult,
  CloudBackupSession,
  CloudBackupSessionResult,
  CloudBackupUploadResult,
} from "@app/types/cloud-backup"
import {
  assertICloudAvailable,
  downloadAppDataFile,
  findAppDataFile,
  ICloudError,
  listAppDataFiles,
  uploadAppDataFile,
} from "@app/utils/icloud-client"

const ICLOUD_SESSION_TOKEN = "icloud"

const ICloudOperation = {
  Availability: "availability",
  Upload: "upload",
  Download: "download",
  List: "list",
} as const

type ICloudOperation = (typeof ICloudOperation)[keyof typeof ICloudOperation]

const reasonFromError = (err: unknown): CloudBackupErrorReason =>
  err instanceof ICloudError ? err.reason : CloudBackupErrorReason.Unknown

const reportICloudError = (operation: ICloudOperation, err: unknown): void => {
  if (err instanceof ICloudError) {
    crashlytics().recordError(err)
    return
  }
  const message = err instanceof Error ? err.message : String(err)
  crashlytics().recordError(new Error(`iCloud ${operation} failed: ${message}`))
}

/** iOS pair of `useGoogleDriveBackup`: synthetic `accessToken`, `fileId === fileName`. */
export const useICloudBackup = () => {
  const [loading, setLoading] = useState(false)

  const startSession = useCallback(
    async (fileName: string): Promise<CloudBackupSessionResult> => {
      try {
        await assertICloudAvailable()
        const existingFileId = await findAppDataFile(fileName)
        return {
          success: true,
          session: { accessToken: ICLOUD_SESSION_TOKEN, existingFileId },
        }
      } catch (err) {
        reportICloudError(ICloudOperation.Availability, err)
        return { success: false, reason: reasonFromError(err) }
      }
    },
    [],
  )

  const upload = useCallback(
    async (
      content: string,
      fileName: string,
      _session: CloudBackupSession,
    ): Promise<CloudBackupUploadResult> => {
      setLoading(true)
      try {
        await uploadAppDataFile({ content, fileName })
        return { success: true }
      } catch (err) {
        reportICloudError(ICloudOperation.Upload, err)
        return { success: false, reason: reasonFromError(err) }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const downloadById = useCallback(
    async (fileId: string, _accessToken: string): Promise<CloudBackupDownloadResult> => {
      setLoading(true)
      try {
        const content = await downloadAppDataFile(fileId)
        return { success: true, content }
      } catch (err) {
        reportICloudError(ICloudOperation.Download, err)
        return { success: false, reason: reasonFromError(err) }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const listBackups = useCallback(
    async (filenamePrefix: string): Promise<CloudBackupListResult> => {
      try {
        await assertICloudAvailable()
        const entries = await listAppDataFiles(filenamePrefix)
        return { success: true, entries, accessToken: ICLOUD_SESSION_TOKEN }
      } catch (err) {
        reportICloudError(ICloudOperation.List, err)
        return { success: false, reason: reasonFromError(err) }
      }
    },
    [],
  )

  const resolveErrorMessage: CloudBackupErrorMessageResolver = useCallback(
    (reason, LL) => {
      if (reason === CloudBackupErrorReason.Auth) {
        return LL.BackupScreen.CloudBackup.cloudNotAvailable()
      }
      if (reason === CloudBackupErrorReason.Transient) {
        return LL.BackupScreen.CloudBackup.networkError()
      }
      return LL.BackupScreen.CloudBackup.signInFailed({
        provider: LL.BackupScreen.BackupMethod.appleICloud(),
      })
    },
    [],
  )

  return {
    startSession,
    upload,
    downloadById,
    listBackups,
    resolveErrorMessage,
    loading,
  }
}
