import { useCallback, useRef, useState } from "react"
import Share, { type ShareOptions } from "react-native-share"

import type { Network } from "@breeztech/breez-sdk-spark-react-native"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { recordAppError, toError } from "@app/utils/error-reporting"
import { networkLabelFor } from "@app/self-custodial/config"
import { decryptBundleBackupPayload } from "@app/self-custodial/recovery-bundle/encryption"
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

const targetFor = (accountId: string, network: Network): string =>
  `${accountId}:${network}`

export type RecoveryBundleActions = {
  /** undefined while the first read is in flight, null when no bundle saved. */
  bundleState: RecoveryBundleState | null | undefined
  sharing: boolean
  reloadState: () => Promise<void>
  /** Resolves false when nothing was exported - a dismissed sheet, no saved
   *  bundle, or a failure already reported to the user. Callers that advance
   *  the flow must gate on it: confirming a file that never left the device is
   *  the one thing this export must not do. */
  handleShare: () => Promise<boolean>
}

/**
 * State and export behind the emergency bundle screen: the saved bundle and its
 * unencrypted export through the share sheet. Keeping the bundle current, on
 * the device and in the cloud, happens in the background (see
 * useRecoveryBundleRefresh); this hook only reads and hands over what is saved.
 * Failures are reported with a toast - the screen stays presentational.
 */
export const useRecoveryBundleActions = (): RecoveryBundleActions => {
  const { LL } = useI18nContext()
  const { activeAccount } = useAccountRegistry()
  const network = useSparkNetwork()

  const accountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null
  const target = accountId === null ? null : targetFor(accountId, network)

  const [bundleRead, setBundleRead] = useState(NO_BUNDLE_READ)
  const [sharing, setSharing] = useState(false)
  const latestRead = useRef(0)
  /** Checked when async work finishes, which may be after an account switch. */
  const activeTarget = useRef(target)
  activeTarget.current = target

  /** Until the active account's own read lands, what the hook holds belongs to
   *  another account, so the bundle reads as still loading. */
  const isBundleReadForTarget = bundleRead.forTarget === target
  const bundleState = isBundleReadForTarget ? bundleRead.value : undefined

  const reloadState = useCallback(async () => {
    /** An action that outlived an account switch still holds this closure, and
     *  reading for its account now would only push out the one on screen. */
    const isTargetActive = target === activeTarget.current
    if (!isTargetActive) return
    latestRead.current += 1
    const read = latestRead.current
    if (!accountId) {
      setBundleRead(NO_BUNDLE_READ)
      return
    }
    let next: RecoveryBundleState | null
    try {
      next = await readRecoveryBundleState(accountId, network)
    } catch (err) {
      // Degrade to "no bundle yet" instead of stranding the screen on the
      // loading state.
      recordAppError(toError(err), { alwaysRecord: true })
      next = null
    }
    /** A read overtaken by a newer one is dropped: after an account switch a
     *  slow read for the previous account would otherwise land last and show
     *  its backup while the actions operate on the new account. */
    const isLatestRead = read === latestRead.current
    if (!isLatestRead) return
    setBundleRead({ forTarget: target, value: next })
  }, [accountId, network, target])

  const recordAndToast = (err: unknown, message: string) => {
    recordAppError(toError(err), { alwaysRecord: true })
    toastShow({ message, LL })
  }

  /** Decrypts the saved bundle for export; requires the seed from the keystore. */
  const loadBundleForExport = async (): Promise<string | null> => {
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

  const handleShare = async (): Promise<boolean> => {
    if (sharing) return false
    setSharing(true)
    try {
      const json = await loadBundleForExport()
      if (!json) return false
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
    sharing,
    reloadState,
    handleShare,
  }
}
