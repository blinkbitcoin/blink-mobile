import { useCallback, useState } from "react"
import DeviceInfo from "react-native-device-info"
import Share, { type ShareOptions } from "react-native-share"

import crashlytics from "@react-native-firebase/crashlytics"

import { useClipboard } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { networkLabelFor } from "@app/self-custodial/config"
import { getRecoveryBundleFilename } from "@app/self-custodial/recovery-bundle/cloud"
import {
  decryptBundleBackupPayload,
  parseBundleBackupMetadata,
} from "@app/self-custodial/recovery-bundle/encryption"
import {
  RecoveryBundleExportError,
  RecoveryBundleExportErrorReason,
} from "@app/self-custodial/recovery-bundle/exporter"
import {
  isCloudSyncAllowedFor,
  markCloudSynced,
  refreshRecoveryBundle,
  syncExistingBundleToCloud,
} from "@app/self-custodial/recovery-bundle/refresh"
import {
  defaultRecoveryBundleSettings,
  readRecoveryBundleSettings,
  writeRecoveryBundleSettings,
  type RecoveryBundleSettings,
} from "@app/self-custodial/recovery-bundle/settings"
import {
  loadEncryptedBundleFile,
  readRecoveryBundleState,
  type RecoveryBundleState,
} from "@app/self-custodial/recovery-bundle/storage"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { AccountType } from "@app/types/wallet"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { toastShow } from "@app/utils/toast"

import { usePlatformCloudBackup } from "../onboarding/hooks/use-platform-cloud-backup"

/** The unencrypted bundle reveals balance and payment structure; don't leave
 * it in the clipboard (cloud clipboard sync, keyboard apps) indefinitely. */
const CLIPBOARD_CLEAR_MS = 60_000

export type RecoveryBundleActions = {
  /** undefined while the first read is in flight, null when no bundle saved. */
  bundleState: RecoveryBundleState | null | undefined
  settings: RecoveryBundleSettings
  refreshing: boolean
  uploading: boolean
  exporting: boolean
  reloadState: () => Promise<void>
  handleRefresh: () => Promise<void>
  handleShare: () => Promise<void>
  handleCopy: () => Promise<void>
  handleCloudUpload: () => Promise<void>
  handleSetAutoRefresh: (enabled: boolean) => Promise<void>
  handleSetCloudSync: (enabled: boolean) => Promise<void>
}

/**
 * State and actions behind the Recovery Backup screen: manual refresh,
 * unencrypted export (share sheet / clipboard) and cloud upload of the saved
 * bundle. Every action reports failure with a toast - the screen stays
 * presentational.
 */
export const useRecoveryBundleActions = (): RecoveryBundleActions => {
  const { LL } = useI18nContext()
  const { copyToClipboard } = useClipboard(CLIPBOARD_CLEAR_MS)
  const { activeAccount } = useAccountRegistry()
  const network = useSparkNetwork()
  const cloudBackup = usePlatformCloudBackup()

  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null

  const [bundleState, setBundleState] = useState<RecoveryBundleState | null | undefined>(
    undefined,
  )
  const [settings, setSettings] = useState<RecoveryBundleSettings>(
    defaultRecoveryBundleSettings,
  )
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const reloadState = useCallback(async () => {
    if (!accountId) {
      setBundleState(null)
      setSettings(defaultRecoveryBundleSettings)
      return
    }
    try {
      const [state, storedSettings] = await Promise.all([
        readRecoveryBundleState(accountId, network),
        readRecoveryBundleSettings(accountId),
      ])
      setBundleState(state)
      setSettings(storedSettings)
    } catch (err) {
      // Degrade to "no bundle yet" instead of stranding the screen on the
      // loading spinner; the manual refresh still works from there.
      crashlytics().recordError(err instanceof Error ? err : new Error(String(err)))
      setBundleState(null)
    }
  }, [accountId, network])

  const recordAndToast = (err: unknown, message: string) => {
    crashlytics().recordError(err instanceof Error ? err : new Error(String(err)))
    toastShow({ message, LL })
  }

  const handleRefresh = async () => {
    if (!accountId || refreshing) return
    setRefreshing(true)
    try {
      const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(accountId)
      if (!mnemonic) {
        toastShow({ message: LL.RecoveryBundleScreen.refreshFailed(), LL })
        return
      }
      const result = await refreshRecoveryBundle({
        accountId,
        network,
        mnemonic,
        appVersion: DeviceInfo.getReadableVersion(),
      })
      if (result.success) {
        setBundleState(result.state)
        toastShow({
          message: LL.RecoveryBundleScreen.refreshSuccess(),
          type: "success",
          LL,
        })
        return
      }
      const emptyWallet =
        result.error instanceof RecoveryBundleExportError &&
        result.error.reason === RecoveryBundleExportErrorReason.NoLeaves
      toastShow({
        message: emptyWallet
          ? LL.RecoveryBundleScreen.refreshEmptyWallet()
          : LL.RecoveryBundleScreen.refreshFailed(),
        type: emptyWallet ? "warning" : "error",
        LL,
      })
    } catch (err) {
      recordAndToast(err, LL.RecoveryBundleScreen.refreshFailed())
    } finally {
      setRefreshing(false)
    }
  }

  /** Decrypts the saved bundle for export; requires the seed from the keystore. */
  const loadDecryptedBundleJson = async (): Promise<string | null> => {
    if (!accountId) return null
    const payload = await loadEncryptedBundleFile(accountId, network)
    if (!payload) {
      toastShow({ message: LL.RecoveryBundleScreen.noBundleToExport(), LL })
      return null
    }
    const mnemonic = await KeyStoreWrapper.getMnemonicForAccount(accountId)
    if (!mnemonic) {
      toastShow({ message: LL.RecoveryBundleScreen.exportFailed(), LL })
      return null
    }
    const bundle = await decryptBundleBackupPayload(payload, mnemonic)
    return JSON.stringify(bundle, null, 2)
  }

  const handleShare = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const json = await loadDecryptedBundleJson()
      if (!json) return
      // `useInternalStorage` is honored by the Android native module
      // (ShareIntent.java) but missing from the lib's ShareOptions type.
      // Android writes data: URLs to a file before sharing; keep the
      // unencrypted bundle out of world-readable external cache storage.
      const options: ShareOptions & { useInternalStorage: boolean } = {
        title: "blink-recovery-bundle",
        filename: `blink-recovery-bundle-${networkLabelFor(network)}.json`,
        url: `data:application/json;base64,${Buffer.from(json, "utf8").toString("base64")}`,
        type: "application/json",
        useInternalStorage: true,
      }
      await Share.open(options)
    } catch (err) {
      const userCancelled =
        err instanceof Error && /User did not share/i.test(err.message)
      if (!userCancelled) {
        recordAndToast(err, LL.RecoveryBundleScreen.exportFailed())
      }
    } finally {
      setExporting(false)
    }
  }

  const handleCopy = async () => {
    try {
      const json = await loadDecryptedBundleJson()
      if (!json) return
      copyToClipboard({ content: json })
    } catch (err) {
      recordAndToast(err, LL.RecoveryBundleScreen.exportFailed())
    }
  }

  const persistSettings = async (next: RecoveryBundleSettings) => {
    if (!accountId) return
    const previous = settings
    setSettings(next)
    try {
      await writeRecoveryBundleSettings(accountId, next)
    } catch (err) {
      setSettings(previous)
      recordAndToast(err, LL.RecoveryBundleScreen.settingUpdateFailed())
      throw err
    }
  }

  const handleSetAutoRefresh = async (enabled: boolean) => {
    await persistSettings({ ...settings, autoRefresh: enabled }).catch(() => {})
  }

  const handleSetCloudSync = async (enabled: boolean) => {
    try {
      await persistSettings({ ...settings, cloudSync: enabled })
    } catch {
      return
    }
    if (!enabled || !accountId) return
    // Opting in with a bundle already on disk: sync right away instead of
    // waiting for the next refresh. Best-effort - the background sync path
    // retries after every refresh.
    try {
      const synced = await syncExistingBundleToCloud(accountId, network)
      if (synced) {
        await reloadState()
        toastShow({
          message: LL.RecoveryBundleScreen.cloudUploadSuccess(),
          type: "success",
          LL,
        })
      }
    } catch (err) {
      recordAndToast(err, LL.RecoveryBundleScreen.exportFailed())
    }
  }

  const handleCloudUpload = async () => {
    if (!accountId || uploading) return
    setUploading(true)
    try {
      // The screen only offers the button when cloud sync is enabled, but the
      // interactive fallback below bypasses the sync path's internal gate, so
      // re-check here (D9: never next to an unencrypted seed).
      if (!(await isCloudSyncAllowedFor(accountId))) return
      // Silent path first (same provider the seed backup uses); fall back to
      // an interactive session when e.g. the Drive token needs a re-sign-in.
      const syncedSilently = await syncExistingBundleToCloud(accountId, network)
      if (syncedSilently) {
        await reloadState()
        toastShow({
          message: LL.RecoveryBundleScreen.cloudUploadSuccess(),
          type: "success",
          LL,
        })
        return
      }

      const payload = await loadEncryptedBundleFile(accountId, network)
      if (!payload) {
        toastShow({ message: LL.RecoveryBundleScreen.noBundleToExport(), LL })
        return
      }
      const metadata = parseBundleBackupMetadata(payload)
      if (!metadata) {
        toastShow({ message: LL.RecoveryBundleScreen.exportFailed(), LL })
        return
      }
      const fileName = getRecoveryBundleFilename(
        metadata.network,
        metadata.walletIdentityPublicKey,
      )

      const session = await cloudBackup.startSession(fileName)
      if (!session.success) {
        toastShow({ message: cloudBackup.resolveErrorMessage(session.reason, LL), LL })
        return
      }
      const upload = await cloudBackup.upload(payload, fileName, session.session)
      if (!upload.success) {
        toastShow({ message: cloudBackup.resolveErrorMessage(upload.reason, LL), LL })
        return
      }

      const next = await markCloudSynced(accountId, network)
      if (next) setBundleState(next)
      toastShow({
        message: LL.RecoveryBundleScreen.cloudUploadSuccess(),
        type: "success",
        LL,
      })
    } catch (err) {
      recordAndToast(err, LL.RecoveryBundleScreen.exportFailed())
    } finally {
      setUploading(false)
    }
  }

  return {
    bundleState,
    settings,
    refreshing,
    uploading,
    exporting,
    reloadState,
    handleRefresh,
    handleShare,
    handleCopy,
    handleCloudUpload,
    handleSetAutoRefresh,
    handleSetCloudSync,
  }
}
