import { useCallback, useRef, useState } from "react"
import DeviceInfo from "react-native-device-info"
import Share, { type ShareOptions } from "react-native-share"

import type { Network } from "@breeztech/breez-sdk-spark-react-native"
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
  withCloudBundleLock,
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

/**
 * A value together with the account and network it was read for. After an
 * account switch the hook still holds the previous account's values until the
 * new account's own read lands, and this tag is what keeps them off its screen.
 */
type TargetBound<T> = { forTarget: string | null; value: T }

const NO_BUNDLE_READ: TargetBound<RecoveryBundleState | null> = {
  forTarget: null,
  value: null,
}

const NO_SETTINGS_READ: TargetBound<RecoveryBundleSettings> = {
  forTarget: null,
  value: defaultRecoveryBundleSettings,
}

const targetFor = (accountId: string, network: Network): string =>
  `${accountId}:${network}`

export type RecoveryBundleActions = {
  /** undefined while the first read is in flight, null when no bundle saved. */
  bundleState: RecoveryBundleState | null | undefined
  settings: RecoveryBundleSettings
  /** False until the active account's own settings have been read. Until
   *  then `settings` holds the defaults as a placeholder, not stored values. */
  settingsLoaded: boolean
  refreshing: boolean
  uploading: boolean
  sharing: boolean
  copying: boolean
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
  const target = accountId === null ? null : targetFor(accountId, network)

  const [bundleRead, setBundleRead] = useState(NO_BUNDLE_READ)
  const [settingsRead, setSettingsRead] = useState(NO_SETTINGS_READ)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  // One export at a time (both paths decrypt the saved bundle), but tracked
  // per action so each button can show its own spinner.
  const [exportAction, setExportAction] = useState<"share" | "copy" | null>(null)
  const latestRead = useRef(0)
  /** Checked when async work finishes, which may be after an account switch. */
  const activeTarget = useRef(target)
  activeTarget.current = target

  /** Until the active account's own read lands, what the hook holds belongs to
   *  another account, so the bundle reads as still loading and the settings as
   *  their defaults. */
  const isBundleReadForTarget = bundleRead.forTarget === target
  const isSettingsReadForTarget = settingsRead.forTarget === target
  const bundleState = isBundleReadForTarget ? bundleRead.value : undefined
  const settings = isSettingsReadForTarget
    ? settingsRead.value
    : defaultRecoveryBundleSettings

  /** A refresh, upload or settings write that finishes after an account switch
   *  ran for the account it started on, so its result must not land on the one
   *  now on screen. */
  const isStillActive = (forTarget: string) => forTarget === activeTarget.current

  const reloadState = useCallback(async () => {
    /** An action that outlived an account switch still holds this closure, and
     *  reading for its account now would only push out the one on screen. */
    const isTargetActive = target === activeTarget.current
    if (!isTargetActive) return
    latestRead.current += 1
    const read = latestRead.current
    if (!accountId) {
      setBundleRead(NO_BUNDLE_READ)
      setSettingsRead(NO_SETTINGS_READ)
      return
    }
    let next: {
      bundle: RecoveryBundleState | null
      settings: RecoveryBundleSettings | null
    }
    try {
      const [state, storedSettings] = await Promise.all([
        readRecoveryBundleState(accountId, network),
        readRecoveryBundleSettings(accountId),
      ])
      next = { bundle: state, settings: storedSettings }
    } catch (err) {
      // Degrade to "no bundle yet" instead of stranding the screen on the
      // loading spinner; the manual refresh still works from there.
      crashlytics().recordError(err instanceof Error ? err : new Error(String(err)))
      next = { bundle: null, settings: null }
    }
    /** A read overtaken by a newer one is dropped: after an account switch a
     *  slow read for the previous account would otherwise land last and show
     *  its backup while the actions operate on the new account. */
    const isLatestRead = read === latestRead.current
    if (!isLatestRead) return
    setBundleRead({ forTarget: target, value: next.bundle })
    if (next.settings) setSettingsRead({ forTarget: target, value: next.settings })
  }, [accountId, network, target])

  const recordAndToast = (err: unknown, message: string) => {
    crashlytics().recordError(err instanceof Error ? err : new Error(String(err)))
    toastShow({ message, LL })
  }

  const handleRefresh = async () => {
    if (!accountId || refreshing) return
    const forTarget = targetFor(accountId, network)
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
        // The user asked for this one, so it must never be served by a run that
        // started earlier: reporting success for a bundle missing the balance
        // they just looked at is the failure this screen exists to prevent.
        coverageKey: `manual:${Date.now()}`,
      })
      if (result.success) {
        if (isStillActive(forTarget)) setBundleRead({ forTarget, value: result.state })
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
    if (exportAction) return
    setExportAction("share")
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
      setExportAction(null)
    }
  }

  const handleCopy = async () => {
    if (exportAction) return
    setExportAction("copy")
    try {
      const json = await loadDecryptedBundleJson()
      if (!json) return
      copyToClipboard({ content: json })
    } catch (err) {
      recordAndToast(err, LL.RecoveryBundleScreen.exportFailed())
    } finally {
      setExportAction(null)
    }
  }

  const persistSettings = async (next: RecoveryBundleSettings) => {
    if (!accountId) return
    /** The switches write the whole object, so one built on the placeholder
     *  would replace the stored value of the switch the user did not touch. */
    if (!isSettingsReadForTarget) return
    const forTarget = targetFor(accountId, network)
    const previous = settings
    setSettingsRead({ forTarget, value: next })
    try {
      await writeRecoveryBundleSettings(accountId, next)
    } catch (err) {
      if (isStillActive(forTarget)) setSettingsRead({ forTarget, value: previous })
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
    if (!enabled || !bundleState) return
    // Opting in with a bundle already on disk: run the full upload flow
    // right away (silent first, then interactive sign-in fallback) instead
    // of waiting for the next refresh - a silent-only attempt is invisible
    // exactly when the provider needs a re-sign-in, which is when the user
    // most needs feedback after opting in. The D9 gate is re-checked inside,
    // against the settings persisted above.
    await handleCloudUpload()
  }

  /**
   * The interactive fallback, run inside the cloud lock like the silent sync:
   * one upload at a time keeps an older payload from landing after a newer
   * one, and a revocation's delete waits for this upload instead of racing it.
   * The D9 gate is checked again once the lock is held, because a revocation
   * turns the opt-in off before it queues behind this upload.
   */
  const uploadInteractively = async (currentAccountId: string): Promise<void> => {
    if (!(await isCloudSyncAllowedFor(currentAccountId))) return

    const payload = await loadEncryptedBundleFile(currentAccountId, network)
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

    const next = await markCloudSynced(
      currentAccountId,
      network,
      metadata.bundleCreatedAt,
    )
    const forTarget = targetFor(currentAccountId, network)
    const isSyncedStateForScreen = next !== null && isStillActive(forTarget)
    if (isSyncedStateForScreen) setBundleRead({ forTarget, value: next })
    toastShow({
      message: LL.RecoveryBundleScreen.cloudUploadSuccess(),
      type: "success",
      LL,
    })
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

      await withCloudBundleLock(accountId, network, () => uploadInteractively(accountId))
    } catch (err) {
      recordAndToast(err, LL.RecoveryBundleScreen.exportFailed())
    } finally {
      setUploading(false)
    }
  }

  return {
    bundleState,
    settings,
    settingsLoaded: isSettingsReadForTarget,
    refreshing,
    uploading,
    sharing: exportAction === "share",
    copying: exportAction === "copy",
    reloadState,
    handleRefresh,
    handleShare,
    handleCopy,
    handleCloudUpload,
    handleSetAutoRefresh,
    handleSetCloudSync,
  }
}
