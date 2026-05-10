import { useCallback, useState } from "react"
import { Platform } from "react-native"

import { GoogleSignin } from "@react-native-google-signin/google-signin"
import crashlytics from "@react-native-firebase/crashlytics"

import {
  findAppDataFile,
  listAppDataFiles,
  uploadAppDataFile,
  downloadAppDataFile,
  DriveError,
  DriveErrorReason,
  type AppDataFileEntry,
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
  Upload: "upload",
  Download: "download",
} as const

type DriveOperation = (typeof DriveOperation)[keyof typeof DriveOperation]

const reasonFromError = (err: unknown): DriveErrorReason =>
  err instanceof DriveError ? err.reason : DriveErrorReason.Unknown

const reportDriveError = (operation: DriveOperation, err: unknown): void => {
  if (err instanceof DriveError) {
    crashlytics().recordError(err)
    return
  }
  const message = err instanceof Error ? err.message : String(err)
  crashlytics().recordError(new Error(`Drive ${operation} failed: ${message}`))
}

type UploadResult = { success: true } | { success: false; reason: DriveErrorReason }
type DownloadResult =
  | { success: true; content: string }
  | { success: false; reason: DriveErrorReason }

type DriveSession = {
  accessToken: string
  existingFileId: string | undefined
}

export const useGoogleDriveBackup = () => {
  const [loading, setLoading] = useState(false)

  const startSession = useCallback(async (fileName: string): Promise<DriveSession> => {
    const accessToken = await signIn()
    const existingFileId = await findAppDataFile(fileName, accessToken)
    return { accessToken, existingFileId }
  }, [])

  const upload = useCallback(
    async (
      content: string,
      fileName: string,
      session: DriveSession,
    ): Promise<UploadResult> => {
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
    async (fileId: string, accessToken: string): Promise<DownloadResult> => {
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
    async (
      filenamePrefix: string,
    ): Promise<{ entries: ReadonlyArray<AppDataFileEntry>; accessToken: string }> => {
      const accessToken = await signIn()
      const entries = await listAppDataFiles(filenamePrefix, accessToken)
      return { entries, accessToken }
    },
    [],
  )

  return { startSession, upload, downloadById, listBackups, loading }
}
