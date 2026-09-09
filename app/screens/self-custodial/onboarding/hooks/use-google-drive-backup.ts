import { useCallback, useState } from "react"
import { Platform } from "react-native"

import {
  GoogleSignin,
  statusCodes,
  type SignInResponse,
} from "@react-native-google-signin/google-signin"

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
import { callDrive } from "@app/utils/google-drive-session"

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

/** Stop before getTokens() when the user dismissed the sheet, so backing out is not filed
 *  as an opaque defect. */
const ensureSignInCompleted = (response: SignInResponse): void => {
  if (response.type === "success") return
  throw new DriveError(
    CloudBackupErrorReason.Cancelled,
    `Drive sign-in did not complete (${response.type})`,
  )
}

const signIn = async (): Promise<string> => {
  configureGoogleSignIn()
  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices()
  }
  await GoogleSignin.signOut().catch(() => {})
  const response = await GoogleSignin.signIn()
  ensureSignInCompleted(response)
  await ensureDriveScope(response)
  const { accessToken } = await GoogleSignin.getTokens()
  return accessToken
}

const DriveOperation = {
  SignIn: "sign-in",
  Find: "find",
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

// A withheld scope or a dismissed sign-in is the user's choice, and a transient blip is
// connectivity, so none of them are defects; they become breadcrumbs instead of the
// non-fatals they would otherwise flood.
const EXPECTED_DRIVE_REASONS: ReadonlySet<CloudBackupErrorReason> = new Set([
  CloudBackupErrorReason.PermissionDenied,
  CloudBackupErrorReason.Cancelled,
  CloudBackupErrorReason.Transient,
])

const isExpectedDriveState = (err: unknown): boolean =>
  (err instanceof DriveError && EXPECTED_DRIVE_REASONS.has(err.reason)) ||
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
      let signedInToken: string
      try {
        signedInToken = await signIn()
      } catch (err) {
        reportDriveError(DriveOperation.SignIn, err)
        return { success: false, reason: reasonFromError(err) }
      }
      try {
        const { value: existingFileId, token } = await callDrive(signedInToken, (t) =>
          findAppDataFile(fileName, t),
        )
        return { success: true, session: { accessToken: token, existingFileId } }
      } catch (err) {
        reportDriveError(DriveOperation.Find, err)
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
        const { token } = await callDrive(session.accessToken, (t) =>
          uploadAppDataFile({
            content,
            fileName,
            accessToken: t,
            existingId: session.existingFileId,
          }),
        )
        return { success: true, accessToken: token }
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
        const { value: content, token } = await callDrive(accessToken, (t) =>
          downloadAppDataFile(fileId, t),
        )
        return { success: true, content, accessToken: token }
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
        const signedInToken = await signIn()
        const { value: entries, token } = await callDrive(signedInToken, (t) =>
          listAppDataFiles(filenamePrefix, t),
        )
        return { success: true, entries, accessToken: token }
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
