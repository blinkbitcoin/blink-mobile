/**
 * Per-account user preferences for the recovery bundle. Kept separate from the
 * per-(account, network) refresh state in storage.ts: these are choices the
 * user makes once, not derived sync metadata, and they apply to the account on
 * every network.
 *
 * Defaults follow the product rules in the blink-specs PRD
 * (spark-unilateral-exit): automatic refresh is on by default with an opt-out
 * to save mobile data; cloud sync of the (seed-encrypted) bundle is opt-in and
 * off by default, even when the seed itself is already backed up to the cloud.
 */

import AsyncStorage from "@react-native-async-storage/async-storage"

const RECOVERY_BUNDLE_SETTINGS_KEY_PREFIX = "recoveryBundleSettings"

const settingsKeyFor = (accountId: string): string =>
  `${RECOVERY_BUNDLE_SETTINGS_KEY_PREFIX}:${accountId}`

export type RecoveryBundleSettings = {
  /** Refresh the bundle automatically after payments and on staleness. */
  autoRefresh: boolean
  /** Upload the encrypted bundle to the seed backup's cloud provider. */
  cloudSync: boolean
  /** Unix ms of the last successful export (share sheet or clipboard), or null
   *  if the bundle has never left this device by the user's own hand. Drives
   *  the "only on this phone" nudge: the automatic on-device copy dies with the
   *  device, so a manual-path user who never exported has no recovery at all. */
  exportedAt: number | null
}

export const defaultRecoveryBundleSettings: RecoveryBundleSettings = {
  autoRefresh: true,
  cloudSync: false,
  exportedAt: null,
}

/** Missing or corrupted stored settings degrade to the defaults. */
export const readRecoveryBundleSettings = async (
  accountId: string,
): Promise<RecoveryBundleSettings> => {
  const raw = await AsyncStorage.getItem(settingsKeyFor(accountId))
  if (!raw) return defaultRecoveryBundleSettings
  try {
    const parsed = JSON.parse(raw)
    return {
      autoRefresh:
        typeof parsed?.autoRefresh === "boolean"
          ? parsed.autoRefresh
          : defaultRecoveryBundleSettings.autoRefresh,
      cloudSync:
        typeof parsed?.cloudSync === "boolean"
          ? parsed.cloudSync
          : defaultRecoveryBundleSettings.cloudSync,
      exportedAt:
        typeof parsed?.exportedAt === "number"
          ? parsed.exportedAt
          : defaultRecoveryBundleSettings.exportedAt,
    }
  } catch {
    return defaultRecoveryBundleSettings
  }
}

export const writeRecoveryBundleSettings = async (
  accountId: string,
  settings: RecoveryBundleSettings,
): Promise<void> => {
  await AsyncStorage.setItem(settingsKeyFor(accountId), JSON.stringify(settings))
}

export const removeRecoveryBundleSettings = async (accountId: string): Promise<void> => {
  await AsyncStorage.removeItem(settingsKeyFor(accountId))
}
