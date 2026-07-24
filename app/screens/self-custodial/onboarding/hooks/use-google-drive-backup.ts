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

/** Not `reason`: 403 shares it but means a withheld permission, which a new token cannot fix. */
const isDeadAccessToken = (err: unknown): boolean =>
  err instanceof DriveError && err.status === 401

/**
 * A revoked token stays in the sign-in cache, so the SDK keeps handing back the same dead
 * one. Clearing it forces a refresh, retried once. The working token comes back because the
 * caller holds it for the rest of the session.
 */
const callDrive = async <T>(
  token: string,
  call: (token: string) => Promise<T>,
): Promise<{ value: T; token: string }> => {
  try {
    return { value: await call(token), token }
  } catch (err) {
    if (!isDeadAccessToken(err)) throw err

    let refreshed: string
    try {
      await GoogleSignin.clearCachedAccessToken(token)
      refreshed = (await GoogleSignin.getTokens()).accessToken
    } catch {
      /** The 401 is the diagnosis; a failure to refresh only says the retry never ran. */
      throw err
    }

    return { value: await call(refreshed), token: refreshed }
  }
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
        const signedInToken = await signIn()
        const { value: existingFileId, token } = await callDrive(signedInToken, (t) =>
          findAppDataFile(fileName, t),
        )
        return { success: true, session: { accessToken: token, existingFileId } }
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
        await callDrive(session.accessToken, (t) =>
          uploadAppDataFile({
            content,
            fileName,
            accessToken: t,
            existingId: session.existingFileId,
          }),
        )
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
        const { value: content } = await callDrive(accessToken, (t) =>
          downloadAppDataFile(fileId, t),
        )
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
