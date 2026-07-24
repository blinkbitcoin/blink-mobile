import { useCallback, useState } from "react"
import { Platform } from "react-native"

import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin"

import { recordAppError } from "@app/utils/error-reporting"

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

// Sign-in outcomes that are user/device states, not defects: cancelled, already in
// progress, no Play services (de-Googled devices), or simply not signed in yet.
const EXPECTED_SIGNIN_CODES: readonly string[] = [
  statusCodes.SIGN_IN_CANCELLED,
  statusCodes.IN_PROGRESS,
  statusCodes.PLAY_SERVICES_NOT_AVAILABLE,
  statusCodes.SIGN_IN_REQUIRED,
].map(String)

const hasSignInCode = (err: unknown): err is { code: unknown } =>
  typeof err === "object" && err !== null && "code" in err

const isExpectedDriveState = (err: unknown): boolean =>
  (err instanceof DriveError && err.reason === CloudBackupErrorReason.Transient) ||
  (hasSignInCode(err) && EXPECTED_SIGNIN_CODES.includes(String(err.code)))

const reportDriveError = (operation: DriveOperation, err: unknown): void => {
  const error =
    err instanceof DriveError
      ? err
      : new Error(
          `Drive ${operation} failed: ${err instanceof Error ? err.message : String(err)}`,
        )
  recordAppError(error, { expected: isExpectedDriveState(err) })
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
