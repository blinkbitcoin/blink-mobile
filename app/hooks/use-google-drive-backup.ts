import { useCallback, useState } from "react"
import { Platform } from "react-native"

import { GoogleSignin } from "@react-native-google-signin/google-signin"

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata"
const DRIVE_APP_DATA_FOLDER = "appDataFolder"
const MULTIPART_BOUNDARY = "blink_backup_boundary"

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

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
  await GoogleSignin.signIn()
  const { accessToken } = await GoogleSignin.getTokens()
  return accessToken
}

const findExistingFileId = async (
  fileName: string,
  accessToken: string,
): Promise<string | undefined> => {
  const query = encodeURIComponent(`name='${fileName}'`)
  const url = `${DRIVE_FILES_URL}?spaces=${DRIVE_APP_DATA_FOLDER}&q=${query}&fields=files(id)`

  const response = await fetch(url, { headers: authHeader(accessToken) })
  if (!response.ok) return undefined

  const data = (await response.json()) as { files: ReadonlyArray<{ id: string }> }
  return data.files[0]?.id
}

const buildMultipartBody = (metadata: string, content: string): string => {
  const part = (contentType: string, data: string) =>
    `--${MULTIPART_BOUNDARY}\r\nContent-Type: ${contentType}\r\n\r\n${data}`

  return [
    part("application/json; charset=UTF-8", metadata),
    part("text/plain; charset=UTF-8", content),
    `--${MULTIPART_BOUNDARY}--`,
  ].join("\r\n")
}

type UploadParams = {
  content: string
  fileName: string
  accessToken: string
  existingId?: string
}

const uploadOrUpdate = async ({
  content,
  fileName,
  accessToken,
  existingId,
}: UploadParams): Promise<void> => {
  const metadata = existingId
    ? JSON.stringify({ name: fileName })
    : JSON.stringify({ name: fileName, parents: [DRIVE_APP_DATA_FOLDER] })

  const body = buildMultipartBody(metadata, content)

  const url = existingId
    ? `${DRIVE_UPLOAD_URL}/${existingId}?uploadType=multipart`
    : `${DRIVE_UPLOAD_URL}?uploadType=multipart`

  const response = await fetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: {
      ...authHeader(accessToken),
      "Content-Type": `multipart/related; boundary=${MULTIPART_BOUNDARY}`,
    },
    body,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`${response.status}: ${errorBody}`)
  }
}

type UploadResult = { success: true } | { success: false; error: string }

type DriveSession = {
  accessToken: string
  existingFileId: string | undefined
}

export const useGoogleDriveBackup = () => {
  const [loading, setLoading] = useState(false)

  const startSession = useCallback(async (fileName: string): Promise<DriveSession> => {
    const accessToken = await signIn()
    const existingFileId = await findExistingFileId(fileName, accessToken)
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
        await uploadOrUpdate({
          content,
          fileName,
          accessToken: session.accessToken,
          existingId: session.existingFileId,
        })
        return { success: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        return { success: false, error: message }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { startSession, upload, loading }
}
