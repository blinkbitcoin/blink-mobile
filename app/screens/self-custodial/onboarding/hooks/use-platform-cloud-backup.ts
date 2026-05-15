import { Platform } from "react-native"

import { type CloudBackupHook } from "@app/types/cloud-backup"

import { useGoogleDriveBackup } from "./use-google-drive-backup"
import { useICloudBackup } from "./use-icloud-backup"

/** Platform dispatcher: iOS uses iCloud, Android uses Google Drive. */
export const usePlatformCloudBackup = (): CloudBackupHook => {
  const driveBackup = useGoogleDriveBackup()
  const iCloudBackup = useICloudBackup()

  return Platform.OS === "ios" ? iCloudBackup : driveBackup
}
