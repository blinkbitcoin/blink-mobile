export const CloudBackupErrorReason = {
  NotFound: "not-found",
  Auth: "auth",
  Transient: "transient",
  Unknown: "unknown",
} as const

export type CloudBackupErrorReason =
  (typeof CloudBackupErrorReason)[keyof typeof CloudBackupErrorReason]

export type AppDataFileEntry = { id: string; name: string }

export type CloudBackupSession = {
  accessToken: string
  existingFileId: string | undefined
}

export type CloudBackupSessionResult =
  | { success: true; session: CloudBackupSession }
  | { success: false; reason: CloudBackupErrorReason }

export type CloudBackupUploadResult =
  | { success: true }
  | { success: false; reason: CloudBackupErrorReason }

export type CloudBackupDownloadResult =
  | { success: true; content: string }
  | { success: false; reason: CloudBackupErrorReason }

export type CloudBackupListResult =
  | {
      success: true
      entries: ReadonlyArray<AppDataFileEntry>
      accessToken: string
    }
  | { success: false; reason: CloudBackupErrorReason }

export type CloudBackupErrorMessageResolver = (
  reason: CloudBackupErrorReason,
  LL: import("@app/i18n/i18n-types").TranslationFunctions,
) => string

export type CloudBackupHook = {
  startSession: (fileName: string) => Promise<CloudBackupSessionResult>
  upload: (
    content: string,
    fileName: string,
    session: CloudBackupSession,
  ) => Promise<CloudBackupUploadResult>
  downloadById: (
    fileId: string,
    accessToken: string,
  ) => Promise<CloudBackupDownloadResult>
  listBackups: (filenamePrefix: string) => Promise<CloudBackupListResult>
  resolveErrorMessage: CloudBackupErrorMessageResolver
  loading: boolean
}
