/**
 * Cloud sync for the encrypted recovery bundle. The event-driven refresh path
 * must never pop UI, so Android only uploads when a silent Google sign-in
 * succeeds (the user linked Drive before, e.g. for the seed backup); iCloud
 * needs no interaction. The Recovery Backup screen offers the interactive
 * session via the shared CloudBackupHook for first-time setup.
 */

import { Platform } from "react-native"

import { GoogleSignin } from "@react-native-google-signin/google-signin"

import { CloudBackupErrorReason } from "@app/types/cloud-backup"
import {
  downloadAppDataFile as driveDownloadAppDataFile,
  findAppDataFile as driveFindAppDataFile,
  uploadAppDataFile as driveUploadAppDataFile,
} from "@app/utils/google-drive-client"
import { callDrive } from "@app/utils/google-drive-session"
import {
  assertICloudAvailable,
  downloadAppDataFile as iCloudDownloadAppDataFile,
  findAppDataFile as iCloudFindAppDataFile,
  uploadAppDataFile as iCloudUploadAppDataFile,
} from "@app/utils/icloud-client"

export const getRecoveryBundleFilenamePrefix = (network: string): string =>
  `blink-spark-recovery-bundle-${network.toLowerCase()}-`

export const getRecoveryBundleFilename = (
  network: string,
  walletIdentifier: string,
): string => `${getRecoveryBundleFilenamePrefix(network)}${walletIdentifier}.json`

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata"

export type SilentCloudUploadResult =
  | { success: true }
  | {
      success: false
      reason: CloudBackupErrorReason
      /** The thrown original, so callers can report a systemic failure with
       * its real message/stack instead of just the mapped reason enum. */
      error?: unknown
    }

const silentDriveAccessToken = async (): Promise<string | null> => {
  GoogleSignin.configure({ scopes: [DRIVE_SCOPE] })
  if (!GoogleSignin.getCurrentUser()) {
    const silent = await GoogleSignin.signInSilently()
    if (silent.type !== "success") return null
  }
  const { accessToken } = await GoogleSignin.getTokens()
  return accessToken
}

/**
 * Best-effort, non-interactive upload. Auth failures are expected (user never
 * linked cloud backup) and reported as a reason, not thrown.
 */
export const attemptSilentCloudUpload = async (
  content: string,
  fileName: string,
): Promise<SilentCloudUploadResult> => {
  try {
    if (Platform.OS === "ios") {
      await assertICloudAvailable()
      await iCloudUploadAppDataFile({ content, fileName })
      return { success: true }
    }

    const accessToken = await silentDriveAccessToken()
    if (!accessToken) return { success: false, reason: CloudBackupErrorReason.Auth }
    // callDrive: the sign-in cache keeps handing back a token revoked
    // out-of-band; on a 401 it clears the cache and retries once with a fresh
    // token, so one revocation cannot permanently kill silent sync.
    const { value: existingId, token: freshToken } = await callDrive(
      accessToken,
      (token) => driveFindAppDataFile(fileName, token),
    )
    await callDrive(freshToken, (token) =>
      driveUploadAppDataFile({ content, fileName, accessToken: token, existingId }),
    )
    return { success: true }
  } catch (err) {
    const reason =
      err && typeof err === "object" && "reason" in err
        ? (err.reason as CloudBackupErrorReason)
        : CloudBackupErrorReason.Unknown
    return { success: false, reason, error: err }
  }
}

export type SilentCloudFetchResult =
  | { success: true; content: string }
  | { success: false; reason: CloudBackupErrorReason }

/**
 * Best-effort, non-interactive read of one known file.
 *
 * The emergency-recovery flow leads with this: the user has just typed a seed
 * that names their bundle exactly, so the app can go and look before asking
 * them to hunt for a file. A sign-in prompt here would defeat the point, so an
 * unlinked Drive is reported as a reason like any other miss.
 */
export const attemptSilentCloudFetch = async (
  fileName: string,
): Promise<SilentCloudFetchResult> => {
  try {
    if (Platform.OS === "ios") {
      await assertICloudAvailable()
      const found = await iCloudFindAppDataFile(fileName)
      if (!found) return { success: false, reason: CloudBackupErrorReason.NotFound }
      return { success: true, content: await iCloudDownloadAppDataFile(found) }
    }

    const accessToken = await silentDriveAccessToken()
    if (!accessToken) return { success: false, reason: CloudBackupErrorReason.Auth }
    const { value: fileId, token: freshToken } = await callDrive(accessToken, (token) =>
      driveFindAppDataFile(fileName, token),
    )
    if (!fileId) return { success: false, reason: CloudBackupErrorReason.NotFound }
    const { value: content } = await callDrive(freshToken, (token) =>
      driveDownloadAppDataFile(fileId, token),
    )
    return { success: true, content }
  } catch (err) {
    const reason =
      err && typeof err === "object" && "reason" in err
        ? (err.reason as CloudBackupErrorReason)
        : CloudBackupErrorReason.Unknown
    return { success: false, reason }
  }
}
