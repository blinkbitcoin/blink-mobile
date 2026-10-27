import { useCallback, useRef, useState } from "react"
import Share, { type ShareOptions } from "react-native-share"

import type { Network } from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { networkLabelFor } from "@app/self-custodial/config"
import { decryptBundleBackupPayload } from "@app/self-custodial/recovery-bundle/encryption"
import { markExported } from "@app/self-custodial/recovery-bundle/refresh"
import {
  defaultRecoveryBundleSettings,
  readRecoveryBundleSettings,
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

/** A decrypted bundle on its way off the device, with the account it was read
 *  from and the version it is, which is what the export gets recorded against. */
type ExportedBundle = { accountId: string; json: string; createdAt: string }

export type RecoveryBundleActions = {
  /** undefined while the first read is in flight, null when no bundle saved. */
  bundleState: RecoveryBundleState | null | undefined
  settings: RecoveryBundleSettings
  /** False until the active account's own settings have been read. Until
   *  then `settings` holds the defaults as a placeholder, not stored values. */
  settingsLoaded: boolean
  sharing: boolean
  reloadState: () => Promise<void>
  /** Resolves false when nothing was exported - a dismissed sheet, no saved
   *  bundle, or a failure already reported to the user. Callers that advance
   *  the flow must gate on it: confirming a file that never left the device is
   *  the one thing this export must not do. */
  handleShare: () => Promise<boolean>
}

/**
 * State and export behind the emergency bundle screen: the saved bundle, the
 * settings that say whether it syncs to the cloud, and the unencrypted export
 * through the share sheet. Failures are reported with a toast - the screen stays
 * presentational.
 */
export const useRecoveryBundleActions = (): RecoveryBundleActions => {
  const { LL } = useI18nContext()
  const { activeAccount } = useAccountRegistry()
  const network = useSparkNetwork()

  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null
  const target = accountId === null ? null : targetFor(accountId, network)

  const [bundleRead, setBundleRead] = useState(NO_BUNDLE_READ)
  const [settingsRead, setSettingsRead] = useState(NO_SETTINGS_READ)
  const [sharing, setSharing] = useState(false)
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

  /** An export that finishes after an account switch ran for the account it
   *  started on, so its result must not land on the one now on screen. */
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
      // loading state.
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

  /** Decrypts the saved bundle for export; requires the seed from the keystore.
   *  Hands back the version it decrypted, which is the one an export carries. */
  const loadBundleForExport = async (): Promise<ExportedBundle | null> => {
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
    return {
      accountId,
      json: JSON.stringify(bundle, null, 2),
      createdAt: bundle.createdAt,
    }
  }

  /** Recorded in the bundle state, against the exact version that left the
   *  device, rather than in the settings: a settings write would carry this
   *  render's copy of the switches and could undo one changed while the share
   *  sheet was open. */
  const recordExport = async (exported: ExportedBundle) => {
    const forTarget = targetFor(exported.accountId, network)
    const next = await markExported(exported.accountId, network, exported.createdAt)
    const isExportedStateForScreen = next !== null && isStillActive(forTarget)
    if (isExportedStateForScreen) setBundleRead({ forTarget, value: next })
  }

  const handleShare = async (): Promise<boolean> => {
    if (sharing) return false
    setSharing(true)
    try {
      const exported = await loadBundleForExport()
      if (!exported) return false
      // `useInternalStorage` is honored by the Android native module
      // (ShareIntent.java) but missing from the lib's ShareOptions type.
      // Android writes data: URLs to a file before sharing; keep the
      // unencrypted bundle out of world-readable external cache storage.
      const options: ShareOptions & { useInternalStorage: boolean } = {
        title: "blink-recovery-bundle",
        filename: `blink-recovery-bundle-${networkLabelFor(network)}.json`,
        url: `data:application/json;base64,${Buffer.from(exported.json, "utf8").toString("base64")}`,
        type: "application/json",
        useInternalStorage: true,
      }
      await Share.open(options)
      // Recorded only after the sheet resolves, so a cancelled share does not
      // count as the user having a copy.
      await recordExport(exported).catch(() => {})
      return true
    } catch (err) {
      /** Dismissing the sheet is a choice, not a failure, so it stays silent -
       *  but it still has to read as "nothing was exported" to the caller,
       *  which otherwise confirms a file that never left the device. */
      const userCancelled =
        err instanceof Error && /User did not share/i.test(err.message)
      if (!userCancelled) {
        recordAndToast(err, LL.RecoveryBundleScreen.exportFailed())
      }
      return false
    } finally {
      setSharing(false)
    }
  }

  return {
    bundleState,
    settings,
    settingsLoaded: isSettingsReadForTarget,
    sharing,
    reloadState,
    handleShare,
  }
}
