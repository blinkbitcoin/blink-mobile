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
  deleteAppDataFile as driveDeleteAppDataFile,
  DriveError,
  findAppDataFile as driveFindAppDataFile,
  listAppDataFiles as driveListAppDataFiles,
  uploadAppDataFile as driveUploadAppDataFile,
} from "@app/utils/google-drive-client"
import { callDrive, configureGoogleSignIn } from "@app/utils/google-drive-session"
import {
  assertICloudAvailable,
  deleteAppDataFile as iCloudDeleteAppDataFile,
  uploadAppDataFile as iCloudUploadAppDataFile,
} from "@app/utils/icloud-client"

export const getRecoveryBundleFilenamePrefix = (network: string): string =>
  `blink-spark-recovery-bundle-${network.toLowerCase()}-`

export const getRecoveryBundleFilename = (
  network: string,
  walletIdentifier: string,
): string => `${getRecoveryBundleFilenamePrefix(network)}${walletIdentifier}.json`

export type SilentCloudResult =
  | { success: true }
  | {
      success: false
      reason: CloudBackupErrorReason
      /** The thrown original, so callers can report a systemic failure with
       * its real message/stack instead of just the mapped reason enum. */
      error?: unknown
    }

const silentFailure = (err: unknown): SilentCloudResult => {
  const reason =
    err && typeof err === "object" && "reason" in err
      ? (err.reason as CloudBackupErrorReason)
      : CloudBackupErrorReason.Unknown
  return { success: false, reason, error: err }
}

const silentDriveAccessToken = async (): Promise<string | null> => {
  configureGoogleSignIn()
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
): Promise<SilentCloudResult> => {
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
    return silentFailure(err)
  }
}

const isMissingDriveFile = (err: unknown): boolean =>
  err instanceof DriveError && err.reason === CloudBackupErrorReason.NotFound

/**
 * Removes every Drive file with exactly this name: Drive allows duplicate
 * names, and two devices syncing the same wallet for the first time can each
 * create one. One already gone, e.g. removed by the other device, counts as
 * removed.
 */
const deleteDriveFilesNamed = async (fileName: string, accessToken: string) => {
  const { value: entries, token: listToken } = await callDrive(accessToken, (token) =>
    driveListAppDataFiles(fileName, token),
  )
  let token = listToken
  for (const entry of entries.filter(({ name }) => name === fileName)) {
    try {
      ;({ token } = await callDrive(token, (current) =>
        driveDeleteAppDataFile(entry.id, current),
      ))
    } catch (err) {
      if (!isMissingDriveFile(err)) throw err
    }
  }
}

/**
 * Best-effort, non-interactive removal of one known file. A file that is not
 * there counts as removed: the caller only needs it gone.
 */
export const attemptSilentCloudDelete = async (
  fileName: string,
): Promise<SilentCloudResult> => {
  try {
    if (Platform.OS === "ios") {
      await assertICloudAvailable()
      await iCloudDeleteAppDataFile(fileName)
      return { success: true }
    }

    const accessToken = await silentDriveAccessToken()
    if (!accessToken) return { success: false, reason: CloudBackupErrorReason.Auth }
    await deleteDriveFilesNamed(fileName, accessToken)
    return { success: true }
  } catch (err) {
    return silentFailure(err)
  }
}
