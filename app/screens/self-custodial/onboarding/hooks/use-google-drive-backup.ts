import { useCallback, useState } from "react"
import { Platform } from "react-native"

import { GoogleSignin } from "@react-native-google-signin/google-signin"
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
  findAppDataFile,
  listAppDataFiles,
  uploadAppDataFile,
  downloadAppDataFile,
  DriveError,
} from "@app/utils/google-drive-client"

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata"

const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    scopes: [DRIVE_SCOPE],
  })
}

const signIn = async (): Promise<string> => {
  configureGoogleSignIn()
  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices()
  }
  await GoogleSignin.signOut().catch(() => {})
  await GoogleSignin.signIn()
  const { accessToken } = await GoogleSignin.getTokens()
  return accessToken
}

const DriveOperation = {
  SignIn: "sign-in",
  Upload: "upload",
  Download: "download",
  List: "list",
} as const

type DriveOperation = (typeof DriveOperation)[keyof typeof DriveOperation]

const reasonFromError = (err: unknown): CloudBackupErrorReason =>
  err instanceof DriveError ? err.reason : CloudBackupErrorReason.Unknown

const reportDriveError = (operation: DriveOperation, err: unknown): void => {
  if (err instanceof DriveError) {
    crashlytics().recordError(err)
    return
  }
  const message = err instanceof Error ? err.message : String(err)
  crashlytics().recordError(new Error(`Drive ${operation} failed: ${message}`))
}

export const useGoogleDriveBackup = () => {
  const [loading, setLoading] = useState(false)

  const startSession = useCallback(
    async (fileName: string): Promise<CloudBackupSessionResult> => {
      try {
        const accessToken = await signIn()
        const existingFileId = await findAppDataFile(fileName, accessToken)
        return { success: true, session: { accessToken, existingFileId } }
      } catch (err) {
        reportDriveError(DriveOperation.SignIn, err)
        return { success: false, reason: reasonFromError(err) }
      }
    },
    [],
  )

  const upload = useCallback(
    async (
      content: string,
      fileName: string,
      session: CloudBackupSession,
    ): Promise<CloudBackupUploadResult> => {
      setLoading(true)
      try {
        await uploadAppDataFile({
          content,
          fileName,
          accessToken: session.accessToken,
          existingId: session.existingFileId,
        })
        return { success: true }
      } catch (err) {
        reportDriveError(DriveOperation.Upload, err)
        return { success: false, reason: reasonFromError(err) }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const downloadById = useCallback(
    async (fileId: string, accessToken: string): Promise<CloudBackupDownloadResult> => {
      setLoading(true)
      try {
        const content = await downloadAppDataFile(fileId, accessToken)
        return { success: true, content }
      } catch (err) {
        reportDriveError(DriveOperation.Download, err)
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
        const accessToken = await signIn()
        const entries = await listAppDataFiles(filenamePrefix, accessToken)
        return { success: true, entries, accessToken }
      } catch (err) {
        reportDriveError(DriveOperation.List, err)
        return { success: false, reason: reasonFromError(err) }
      }
    },
    [],
  )

  const resolveErrorMessage: CloudBackupErrorMessageResolver = useCallback(
    (reason, LL) => {
      if (reason === CloudBackupErrorReason.Transient) {
        return LL.BackupScreen.CloudBackup.networkError()
      }
      return LL.BackupScreen.CloudBackup.signInFailed({
        provider: LL.BackupScreen.BackupMethod.googleDrive(),
      })
    },
    [],
  )

  return { startSession, upload, downloadById, listBackups, resolveErrorMessage, loading }
}
