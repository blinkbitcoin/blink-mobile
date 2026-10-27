import {
  CloudStorage,
  CloudStorageError,
  CloudStorageErrorCode,
  CloudStorageProvider,
  CloudStorageScope,
} from "react-native-cloud-storage"

import { type AppDataFileEntry, CloudBackupErrorReason } from "@app/types/cloud-backup"

export class ICloudError extends Error {
  constructor(
    readonly reason: CloudBackupErrorReason,
    message: string,
  ) {
    super(message)
    this.name = "ICloudError"
  }
}

const ERROR_CODE_TO_REASON: Readonly<
  Partial<Record<CloudStorageErrorCode, CloudBackupErrorReason>>
> = {
  [CloudStorageErrorCode.FILE_NOT_FOUND]: CloudBackupErrorReason.NotFound,
  [CloudStorageErrorCode.DIRECTORY_NOT_FOUND]: CloudBackupErrorReason.NotFound,
  [CloudStorageErrorCode.AUTHENTICATION_FAILED]: CloudBackupErrorReason.Auth,
  [CloudStorageErrorCode.ACCESS_TOKEN_MISSING]: CloudBackupErrorReason.Auth,
  [CloudStorageErrorCode.NETWORK_ERROR]: CloudBackupErrorReason.Transient,
  [CloudStorageErrorCode.READ_ERROR]: CloudBackupErrorReason.Transient,
  [CloudStorageErrorCode.WRITE_ERROR]: CloudBackupErrorReason.Transient,
  [CloudStorageErrorCode.DELETE_ERROR]: CloudBackupErrorReason.Transient,
  [CloudStorageErrorCode.FILE_NOT_DOWNLOADABLE]: CloudBackupErrorReason.Transient,
}

const classifyCloudStorageError = (err: CloudStorageError): CloudBackupErrorReason =>
  ERROR_CODE_TO_REASON[err.code] ?? CloudBackupErrorReason.Unknown

const toICloudError = (err: unknown, operation: string): ICloudError => {
  if (err instanceof ICloudError) return err
  if (err instanceof CloudStorageError) {
    return new ICloudError(
      classifyCloudStorageError(err),
      `iCloud ${operation} failed (${err.code}): ${err.message}`,
    )
  }
  const message = err instanceof Error ? err.message : String(err)
  return new ICloudError(
    CloudBackupErrorReason.Unknown,
    `iCloud ${operation} failed: ${message}`,
  )
}

/** Idempotent init: AppData scope mirrors Drive's appDataFolder (hidden from Files.app). */
let providerConfigured = false
const ensureICloudProviderConfigured = (): void => {
  if (providerConfigured) return
  CloudStorage.setProvider(CloudStorageProvider.ICloud)
  CloudStorage.setProviderOptions({ scope: CloudStorageScope.AppData })
  providerConfigured = true
}

export const assertICloudAvailable = async (): Promise<void> => {
  ensureICloudProviderConfigured()
  let available: boolean
  try {
    available = await CloudStorage.isCloudAvailable()
  } catch (err) {
    throw toICloudError(err, "availability check")
  }
  if (!available) {
    throw new ICloudError(
      CloudBackupErrorReason.Auth,
      "iCloud Drive is not available. Sign in to iCloud and enable iCloud Drive for this app in Settings.",
    )
  }
}

export const findAppDataFile = async (fileName: string): Promise<string | undefined> => {
  ensureICloudProviderConfigured()
  try {
    const exists = await CloudStorage.exists(fileName, CloudStorageScope.AppData)
    return exists ? fileName : undefined
  } catch (err) {
    throw toICloudError(err, "query")
  }
}

export const listAppDataFiles = async (
  filenamePrefix: string,
): Promise<ReadonlyArray<AppDataFileEntry>> => {
  ensureICloudProviderConfigured()
  let names: ReadonlyArray<string>
  try {
    names = await CloudStorage.readdir("/", CloudStorageScope.AppData)
  } catch (err) {
    throw toICloudError(err, "list")
  }
  return names
    .filter((name) => name.startsWith(filenamePrefix))
    .map((name) => ({ id: name, name }))
}

type UploadParams = {
  content: string
  fileName: string
}

export const uploadAppDataFile = async ({
  content,
  fileName,
}: UploadParams): Promise<void> => {
  ensureICloudProviderConfigured()
  try {
    await CloudStorage.writeFile(fileName, content, CloudStorageScope.AppData)
  } catch (err) {
    throw toICloudError(err, "upload")
  }
}

/** Up to iOS 16, an item that is in iCloud but not downloaded on this device
 *  shows up only as this placeholder, and removing the placeholder removes the
 *  item. Looking for the real name alone would miss it. */
const iCloudPlaceholderNameFor = (fileName: string): string => `.${fileName}.icloud`

/**
 * Removes the item whether it is downloaded or only a placeholder, and resolves
 * once neither form remains. Each name is checked first: unlinking a path that
 * is not there fails with the same delete error as a real failure, not as
 * not-found, and the placeholder is absent whenever the item is downloaded.
 */
export const deleteAppDataFile = async (fileName: string): Promise<void> => {
  ensureICloudProviderConfigured()
  for (const name of [fileName, iCloudPlaceholderNameFor(fileName)]) {
    try {
      const isPresent = await CloudStorage.exists(name, CloudStorageScope.AppData)
      if (isPresent) await CloudStorage.unlink(name, CloudStorageScope.AppData)
    } catch (err) {
      const error = toICloudError(err, "delete")
      if (error.reason !== CloudBackupErrorReason.NotFound) throw error
    }
  }
}

export const downloadAppDataFile = async (fileId: string): Promise<string> => {
  ensureICloudProviderConfigured()
  try {
    await CloudStorage.triggerSync(fileId, CloudStorageScope.AppData).catch(() => {})
    return await CloudStorage.readFile(fileId, CloudStorageScope.AppData)
  } catch (err) {
    throw toICloudError(err, "download")
  }
}
