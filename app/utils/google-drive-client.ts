import Crypto from "react-native-quick-crypto"

type UploadParams = {
  content: string
  fileName: string
  accessToken: string
  existingId?: string
}

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"
const DRIVE_APP_DATA_FOLDER = "appDataFolder"

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

const randomBoundary = (): string => `blink_${Crypto.randomBytes(16).toString("hex")}`

const escapeFileName = (name: string): string =>
  name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")

export const buildMultipartBody = (
  metadata: string,
  content: string,
  boundary: string,
): string => {
  const part = (contentType: string, data: string) =>
    `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n${data}`

  return [
    part("application/json; charset=UTF-8", metadata),
    part("text/plain; charset=UTF-8", content),
    `--${boundary}--`,
  ].join("\r\n")
}

export const findAppDataFile = async (
  fileName: string,
  accessToken: string,
): Promise<string | undefined> => {
  const safeName = escapeFileName(fileName)
  const query = encodeURIComponent(
    `name='${safeName}' and '${DRIVE_APP_DATA_FOLDER}' in parents and trashed = false`,
  )
  const url = `${DRIVE_FILES_URL}?spaces=${DRIVE_APP_DATA_FOLDER}&q=${query}&fields=files(id)`

  const response = await fetch(url, { headers: authHeader(accessToken) })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Drive query failed (${response.status}): ${body}`)
  }

  const data = (await response.json()) as { files: ReadonlyArray<{ id: string }> }
  return data.files[0]?.id
}

export type AppDataFileEntry = { id: string; name: string }

export const listAppDataFiles = async (
  filenamePrefix: string,
  accessToken: string,
): Promise<ReadonlyArray<AppDataFileEntry>> => {
  const safePrefix = escapeFileName(filenamePrefix)
  const query = encodeURIComponent(
    `name contains '${safePrefix}' and '${DRIVE_APP_DATA_FOLDER}' in parents and trashed = false`,
  )
  const url = `${DRIVE_FILES_URL}?spaces=${DRIVE_APP_DATA_FOLDER}&q=${query}&fields=files(id,name)`

  const response = await fetch(url, { headers: authHeader(accessToken) })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Drive list query failed (${response.status}): ${body}`)
  }

  const data = (await response.json()) as { files: ReadonlyArray<AppDataFileEntry> }
  return data.files.filter((f) => f.name.startsWith(filenamePrefix))
}

export const uploadAppDataFile = async ({
  content,
  fileName,
  accessToken,
  existingId,
}: UploadParams): Promise<void> => {
  const metadata = existingId
    ? JSON.stringify({ name: fileName })
    : JSON.stringify({ name: fileName, parents: [DRIVE_APP_DATA_FOLDER] })

  const boundary = randomBoundary()
  const body = buildMultipartBody(metadata, content, boundary)

  const url = existingId
    ? `${DRIVE_UPLOAD_URL}/${existingId}?uploadType=multipart`
    : `${DRIVE_UPLOAD_URL}?uploadType=multipart`

  const response = await fetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: {
      ...authHeader(accessToken),
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Drive upload failed (${response.status}): ${errorBody}`)
  }
}

export const downloadAppDataFile = async (
  fileId: string,
  accessToken: string,
): Promise<string> => {
  const url = `${DRIVE_FILES_URL}/${fileId}?alt=media`
  const response = await fetch(url, { headers: authHeader(accessToken) })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Drive download failed (${response.status}): ${body}`)
  }

  return response.text()
}
