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
  findAppDataFile as driveFindAppDataFile,
  uploadAppDataFile as driveUploadAppDataFile,
} from "@app/utils/google-drive-client"
import {
  assertICloudAvailable,
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
  | { success: false; reason: CloudBackupErrorReason }

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
    const existingId = await driveFindAppDataFile(fileName, accessToken)
    await driveUploadAppDataFile({ content, fileName, accessToken, existingId })
    return { success: true }
  } catch (err) {
    const reason =
      err && typeof err === "object" && "reason" in err
        ? (err.reason as CloudBackupErrorReason)
        : CloudBackupErrorReason.Unknown
    return { success: false, reason }
  }
}
