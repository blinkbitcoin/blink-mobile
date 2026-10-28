import { useCallback, useState } from "react"
import { Platform } from "react-native"

import { type Network } from "@breeztech/breez-sdk-spark-react-native"

import { getCloudBackupFilename } from "@app/config/appinfo"
import { useAppConfig } from "@app/hooks"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { logSelfCustodialBackupCompleted } from "@app/self-custodial/analytics"
import { useSelfCustodialAccountInfo } from "@app/self-custodial/hooks/use-self-custodial-account-info"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { BackupMethod } from "@app/self-custodial/providers/backup-state"
import {
  revokeCloudRecoveryBundle,
  syncExistingBundleToCloud,
} from "@app/self-custodial/recovery-bundle/refresh"
import {
  readRecoveryBundleSettings,
  writeRecoveryBundleSettings,
} from "@app/self-custodial/recovery-bundle/settings"
import { CloudBackupErrorReason } from "@app/types/cloud-backup"
import { reportError } from "@app/utils/error-logging"
import {
  buildBackupPayload,
  type BackupMetadata,
  parseBackupMetadata,
} from "@app/utils/backup-payload"
import { confirmDialog } from "@app/utils/confirm-dialog"
import { toastShow } from "@app/utils/toast"

import { getCloudProviderName } from "../utils"

import { useCompleteBackup } from "./use-complete-backup"
import { usePlatformCloudBackup } from "./use-platform-cloud-backup"
import {
  useBackupAccountId,
  useWalletIdentity,
  useWalletMnemonicState,
} from "./use-wallet-mnemonic"

const DEFAULT_BACKUP_VERSION = 1

const buildExistingBackupMessage = (
  metadata: BackupMetadata | null,
  provider: string,
  LL: TranslationFunctions,
): string => {
  const t = LL.BackupScreen.CloudBackup
  if (!metadata) return t.existingBackupMessage({ provider })

  const address = metadata.lightningAddress ?? t.existingBackupUnknownAddress()
  const createdAt =
    metadata.createdAt > 0
      ? new Date(metadata.createdAt).toLocaleString()
      : t.existingBackupUnknownCreatedAt()

  return t.existingBackupMessageWithDetails({ provider, address, createdAt })
}

/**
 * Stores the automatic-backups choice once a password-protected seed backup landed,
 * opt-out as well as opt-in. An opt-in also uploads the bundle already on disk: the
 * refresh hook syncs straight away only when the seed backup turns password-protected,
 * so a re-backup over one that already was, or an earlier upload that failed, would
 * otherwise wait for the next payment. Resolves false when the choice could not be
 * stored.
 */
const recordBundleSyncChoice = async (
  accountId: string,
  network: Network,
  isOptedIn: boolean,
): Promise<boolean> => {
  try {
    const current = await readRecoveryBundleSettings(accountId)
    const isChoiceChanged = current.cloudSync !== isOptedIn
    if (isChoiceChanged) {
      await writeRecoveryBundleSettings(accountId, { ...current, cloudSync: isOptedIn })
    }
  } catch (err) {
    reportError("Recovery bundle cloud-sync choice", err)
    return false
  }
  if (isOptedIn) {
    syncExistingBundleToCloud(accountId, network).catch((err) =>
      reportError("Recovery bundle sync after opt-in", err),
    )
  }
  return true
}

type UseCloudBackupParams = {
  isEncrypted: boolean
  password: string
  /** Opt-in to ongoing cloud sync of the recovery backup (D4, off by default). */
  autoBundleSync?: boolean
  /** Whether autoBundleSync is a choice to store: the saved one or one the user just
   *  made. When it is not, the stored choice is left alone. */
  isAutoBundleSyncKnown?: boolean
  version?: number
}

export const useCloudBackup = ({
  isEncrypted,
  password,
  autoBundleSync = false,
  isAutoBundleSyncKnown = false,
  version = DEFAULT_BACKUP_VERSION,
}: UseCloudBackupParams) => {
  const { LL } = useI18nContext()
  const completeBackup = useCompleteBackup()
  const network = useSparkNetwork()
  const { appConfig } = useAppConfig()
  const { startSession, upload, downloadById, resolveErrorMessage, loading } =
    usePlatformCloudBackup()
  const { mnemonic, loading: mnemonicLoading } = useWalletMnemonicState()
  const { pubkey: identityPubkey, loading: identityLoading } = useWalletIdentity(mnemonic)
  const { lightningAddress } = useSelfCustodialAccountInfo()
  /** The same account the phrase above was read from: mid-migration that is the
   *  provisioned self-custodial one, not the still-custodial active account. */
  const backupAccountId = useBackupAccountId()

  /** The phrase is read from the keychain before the pubkey can derive from it; both
   *  windows leave the pubkey empty without it being a failure. */
  const identityPending = mnemonicLoading || identityLoading

  const backUp = useCallback(async () => {
    const provider = getCloudProviderName(LL)

    /** Every non-cancelled Drive failure carries its own remedy (e.g. storageAccessRequired for
     *  a withheld scope), so it routes through the resolver instead of a generic toast;
     *  cancellation is the user's own action and stays silent. */
    const toastFailure = (reason: CloudBackupErrorReason) => {
      if (reason === CloudBackupErrorReason.Cancelled) return
      toastShow({ message: resolveErrorMessage(reason, LL), LL })
    }

    /** The CTA is disabled while the phrase reads and the pubkey derives, so reaching this
     *  mid-flight is a race, not a failure; stay silent instead of flashing a toast. */
    if (identityPending) return

    if (!identityPubkey) {
      /** The pubkey is derived locally from the phrase, with no cloud involved, so a missing
       *  one is a local failure: signInFailed would misdirect the user to their cloud account. */
      toastShow({ message: LL.BackupScreen.CloudBackup.uploadFailed(), LL })
      return
    }

    const filename = getCloudBackupFilename(appConfig.galoyInstance.name, identityPubkey)

    const sessionResult = await startSession(filename)
    if (!sessionResult.success) {
      toastFailure(sessionResult.reason)
      return
    }
    const { session } = sessionResult
    let { accessToken } = session

    if (session.existingFileId) {
      const downloadResult = await downloadById(session.existingFileId, accessToken)

      if (
        !downloadResult.success &&
        downloadResult.reason !== CloudBackupErrorReason.NotFound
      ) {
        toastFailure(downloadResult.reason)
        return
      }

      if (downloadResult.success && downloadResult.accessToken) {
        accessToken = downloadResult.accessToken
      }

      const metadata = downloadResult.success
        ? parseBackupMetadata(downloadResult.content)
        : null

      const confirmed = await confirmDialog({
        title: LL.BackupScreen.CloudBackup.existingBackupTitle(),
        message: buildExistingBackupMessage(metadata, provider, LL),
        labels: {
          cancel: LL.common.cancel(),
          confirm: LL.BackupScreen.CloudBackup.overwrite(),
        },
      })
      if (!confirmed) return
    }

    const isPasswordProtected = isEncrypted && password.length > 0
    /**
     * A recovery bundle uploaded beside an earlier password-protected seed backup is
     * encrypted with this same seed, so a seed stored without a password would decrypt it
     * on the spot (D9). The bundle has to leave the cloud before that seed arrives, and
     * the backup stops here when it cannot.
     */
    if (!isPasswordProtected) {
      const isBundleRevoked =
        backupAccountId !== null &&
        (await revokeCloudRecoveryBundle({ accountId: backupAccountId, mnemonic }))
      if (!isBundleRevoked) {
        toastShow({ message: LL.BackupScreen.CloudBackup.uploadFailed(), LL })
        return
      }
    }

    const payload = buildBackupPayload(mnemonic, {
      walletIdentifier: identityPubkey,
      lightningAddress: lightningAddress ?? undefined,
      password: isEncrypted ? password : undefined,
      version,
    })

    const result = await upload(payload, filename, { ...session, accessToken })
    if (!result.success) {
      toastFailure(result.reason)
      return
    }

    /** The choice is stored only once the seed backup actually landed, so a failed
     *  upload never leaves sync enabled for a provider that holds nothing, and only
     *  beside a password (D9): a passwordless backup already turned it off above. */
    const isSyncChoiceRecordable = isPasswordProtected && isAutoBundleSyncKnown
    const syncChoiceAccountId = isSyncChoiceRecordable ? backupAccountId : null
    const isSyncChoiceSaved = syncChoiceAccountId
      ? await recordBundleSyncChoice(syncChoiceAccountId, network, autoBundleSync)
      : true

    logSelfCustodialBackupCompleted({
      backupMethod: Platform.OS === "ios" ? "icloud" : "google_drive",
    })
    /** The seed backup succeeded either way, so the flow still completes; an
     *  unsaved choice is said plainly instead of passing for full success. */
    const backupToast = isSyncChoiceSaved
      ? {
          message: LL.BackupScreen.CloudBackup.uploadSuccess({ provider }),
          type: "success" as const,
        }
      : {
          message: LL.BackupScreen.CloudBackup.autoBundleSyncNotSaved({ provider }),
          type: "warning" as const,
        }
    toastShow({ ...backupToast, LL })
    /** Awaited, so the guard below holds until a migration's own writes land:
     *  released earlier, a second backup could start before this one navigates. */
    await completeBackup({
      method: BackupMethod.Cloud,
      // Whether the seed backup carries an extra password gates the
      // recovery-bundle cloud sync (D9), so record it with the completion.
      backupOptions: { cloudPasswordProtected: isPasswordProtected },
    })
  }, [
    isEncrypted,
    password,
    autoBundleSync,
    isAutoBundleSyncKnown,
    version,
    backupAccountId,
    network,
    startSession,
    upload,
    downloadById,
    resolveErrorMessage,
    completeBackup,
    LL,
    appConfig.galoyInstance.name,
    mnemonic,
    identityPubkey,
    identityPending,
    lightningAddress,
  ])

  /** One backup at a time, from the first tap until it settles. The platform hook
   *  reports loading only around its own calls, not the availability check, the
   *  existing-file lookup or the confirmation in between, and a second run there
   *  would race the first with whatever passphrase the screen shows by then. The
   *  ref guard catches two taps in the same render; the state is what the screen
   *  reads to hold its fields. */
  const { run: runGuarded } = useInFlightGuard()
  const [isBackingUp, setIsBackingUp] = useState(false)
  const handleBackup = useCallback(
    () =>
      runGuarded(async () => {
        setIsBackingUp(true)
        try {
          await backUp()
        } finally {
          setIsBackingUp(false)
        }
      }),
    [runGuarded, backUp],
  )

  const isBackupBusy = loading || identityPending || isBackingUp

  return { handleBackup, loading: isBackupBusy }
}
