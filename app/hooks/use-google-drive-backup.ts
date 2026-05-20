import { useCallback, useState } from "react"
import { Platform } from "react-native"

import { GoogleSignin } from "@react-native-google-signin/google-signin"

import {
  findAppDataFile,
  uploadAppDataFile,
  downloadAppDataFile,
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

  const download = useCallback(async (session: DriveSession): Promise<DownloadResult> => {
    setLoading(true)
    try {
      if (!session.existingFileId) {
        return { success: false, error: "no-backup-found" }
      }
      const content = await downloadAppDataFile(
        session.existingFileId,
        session.accessToken,
      )
      return { success: true, content }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      console.error("[GoogleDrive] Download error:", message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [])

  return { startSession, upload, download, loading }
}
