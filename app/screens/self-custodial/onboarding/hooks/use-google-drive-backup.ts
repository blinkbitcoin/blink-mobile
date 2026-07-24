import { useCallback, useState } from "react"
import { Platform } from "react-native"

import {
  GoogleSignin,
  type SignInResponse,
} from "@react-native-google-signin/google-signin"
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

/**
 * Google's granular consent lets the user finish sign-in with the Drive scope unchecked,
 * so the grant is read back instead of assumed. A response with no scope list is left
 * alone, so an unexpected shape never forces a needless re-prompt.
 */
const grantedScopes = (response: SignInResponse | null): readonly string[] | undefined =>
  response?.type === "success" ? response.data.scopes : undefined

const isDriveScopeDeclined = (response: SignInResponse | null): boolean => {
  const scopes = grantedScopes(response)
  if (!Array.isArray(scopes)) return false
  return !scopes.includes(DRIVE_SCOPE)
}

/**
 * Re-prompts once. A first refusal is usually a misread consent screen; a second is a
 * decision, and asking in a loop would trap the user. The retry demands a positive grant:
 * having just asked for this one scope, an answer that does not name it is not a yes.
 */
const ensureDriveScope = async (response: SignInResponse): Promise<void> => {
  if (!isDriveScopeDeclined(response)) return

  const retried = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] })
  if (grantedScopes(retried)?.includes(DRIVE_SCOPE)) return

  throw new DriveError(
    CloudBackupErrorReason.PermissionDenied,
    "Drive sign-in completed without the appdata scope",
  )
}

const signIn = async (): Promise<string> => {
  configureGoogleSignIn()
  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices()
  }
  await GoogleSignin.signOut().catch(() => {})
  const response = await GoogleSignin.signIn()
  await ensureDriveScope(response)
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
    /** A withheld scope is the user's choice, not a defect, so it stays out of the crash
     *  reports it would otherwise flood. */
    if (err.reason === CloudBackupErrorReason.PermissionDenied) return
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
      if (reason === CloudBackupErrorReason.PermissionDenied) {
        return LL.BackupScreen.CloudBackup.storageAccessRequired({
          provider: LL.BackupScreen.BackupMethod.googleDrive(),
        })
      }
      return LL.BackupScreen.CloudBackup.signInFailed({
        provider: LL.BackupScreen.BackupMethod.googleDrive(),
      })
    },
    [],
  )

  return { startSession, upload, downloadById, listBackups, resolveErrorMessage, loading }
}
