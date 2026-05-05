import { useCallback, useState } from "react"
import { Platform } from "react-native"

import { GoogleSignin } from "@react-native-google-signin/google-signin"

import {
  findAppDataFile,
  listAppDataFiles,
  uploadAppDataFile,
  downloadAppDataFile,
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

type UploadResult = { success: true } | { success: false; error: string }
type DownloadResult =
  | { success: true; content: string }
  | { success: false; error: string }

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
        const message = err instanceof Error ? err.message : "Unknown error"
        console.error("[GoogleDrive] Upload error:", message)
        return { success: false, error: message }
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
        const message = err instanceof Error ? err.message : "Unknown error"
        console.error("[GoogleDrive] Download error:", message)
        return { success: false, error: message }
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
