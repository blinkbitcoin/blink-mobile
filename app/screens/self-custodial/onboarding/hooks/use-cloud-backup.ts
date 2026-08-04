import { useCallback } from "react"
import { Platform } from "react-native"

import { getCloudBackupFilename } from "@app/config/appinfo"
import { useAppConfig } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { logSelfCustodialBackupCompleted } from "@app/self-custodial/analytics"
import { useSelfCustodialAccountInfo } from "@app/self-custodial/hooks/use-self-custodial-account-info"
import { BackupMethod } from "@app/self-custodial/providers/backup-state"
import {
  readRecoveryBundleSettings,
  writeRecoveryBundleSettings,
} from "@app/self-custodial/recovery-bundle/settings"
import { AccountType } from "@app/types/wallet"
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
import { useWalletIdentity, useWalletMnemonic } from "./use-wallet-mnemonic"

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

type UseCloudBackupParams = {
  isEncrypted: boolean
  password: string
  /** Opt-in to ongoing cloud sync of the recovery backup (D4, off by default). */
  autoBundleSync?: boolean
  version?: number
}

export const useCloudBackup = ({
  isEncrypted,
  password,
  autoBundleSync = false,
  version = DEFAULT_BACKUP_VERSION,
}: UseCloudBackupParams) => {
  const { LL } = useI18nContext()
  const completeBackup = useCompleteBackup()
  const { appConfig } = useAppConfig()
  const { startSession, upload, downloadById, resolveErrorMessage, loading } =
    usePlatformCloudBackup()
  const mnemonic = useWalletMnemonic()
  const identityPubkey = useWalletIdentity(mnemonic)
  const { lightningAddress } = useSelfCustodialAccountInfo()
  const { activeAccount } = useAccountRegistry()

  const handleBackup = useCallback(async () => {
    const provider = getCloudProviderName(LL)

    /** Every non-cancelled Drive failure carries its own remedy (e.g. storageAccessRequired for
     *  a withheld scope), so it routes through the resolver instead of a generic toast;
     *  cancellation is the user's own action and stays silent. */
    const toastFailure = (reason: CloudBackupErrorReason) => {
      if (reason === CloudBackupErrorReason.Cancelled) return
      toastShow({ message: resolveErrorMessage(reason, LL), LL })
    }

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

    /** Record the opt-in only once the seed backup actually landed, and only
     *  alongside a password (D9). A failed upload must not leave sync enabled
     *  for a provider that holds nothing. Failure here is not fatal: the seed
     *  backup succeeded, and the toggle is available again in Settings. */
    const accountId =
      activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null
    if (accountId && autoBundleSync && isEncrypted && password.length > 0) {
      await writeRecoveryBundleSettings(accountId, {
        ...(await readRecoveryBundleSettings(accountId)),
        cloudSync: true,
      }).catch((err) => reportError("Recovery bundle cloud-sync opt-in", err))
    }

    logSelfCustodialBackupCompleted({
      backupMethod: Platform.OS === "ios" ? "icloud" : "google_drive",
    })
    toastShow({
      message: LL.BackupScreen.CloudBackup.uploadSuccess({ provider }),
      type: "success",
      LL,
    })
    completeBackup({
      method: BackupMethod.Cloud,
      // Whether the seed backup carries an extra password gates the
      // recovery-bundle cloud sync (D9), so record it with the completion.
      backupOptions: { cloudPasswordProtected: isEncrypted && password.length > 0 },
    })
  }, [
    isEncrypted,
    password,
    autoBundleSync,
    activeAccount,
    version,
    startSession,
    upload,
    downloadById,
    resolveErrorMessage,
    completeBackup,
    LL,
    appConfig.galoyInstance.name,
    mnemonic,
    identityPubkey,
    lightningAddress,
  ])

  return { handleBackup, loading }
}
