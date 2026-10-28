import { useCallback, useState } from "react"
import { Platform } from "react-native"

import { getCloudBackupFilename } from "@app/config/appinfo"
import { useAppConfig } from "@app/hooks"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { logSelfCustodialBackupCompleted } from "@app/self-custodial/analytics"
import { useSelfCustodialAccountInfo } from "@app/self-custodial/hooks/use-self-custodial-account-info"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { BackupMethod } from "@app/self-custodial/providers/backup-state"
import { syncExistingBundleToCloud } from "@app/self-custodial/recovery-bundle/refresh"
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

type UseCloudBackupParams = {
  /** Every new cloud backup carries a passphrase: the emergency bundle follows
   *  the seed to the cloud, encrypted with that same seed, so the passphrase is
   *  what protects both. */
  password: string
  version?: number
}

export const useCloudBackup = ({
  password,
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

    const payload = buildBackupPayload(mnemonic, {
      walletIdentifier: identityPubkey,
      lightningAddress: lightningAddress ?? undefined,
      password,
      version,
    })

    const result = await upload(payload, filename, { ...session, accessToken })
    if (!result.success) {
      toastFailure(result.reason)
      return
    }

    logSelfCustodialBackupCompleted({
      backupMethod: Platform.OS === "ios" ? "icloud" : "google_drive",
    })
    toastShow({
      message: LL.BackupScreen.CloudBackup.uploadSuccess({ provider }),
      type: "success",
      LL,
    })
    /** Awaited, so the guard below holds until a migration's own writes land:
     *  released earlier, a second backup could start before this one navigates. */
    await completeBackup({ method: BackupMethod.Cloud })

    /**
     * A cloud seed backup puts the recovery bundle in the same cloud, with or
     * without a passphrase, and keeps it there automatically. The refresh hook
     * uploads straight away only when the active account's seed first reaches
     * the cloud, so a re-backup, an earlier upload that failed, or a migration's
     * account that is not active yet would otherwise wait for the next payment.
     * Runs after the completion is recorded, since the upload checks it.
     */
    if (backupAccountId) {
      syncExistingBundleToCloud(backupAccountId, network).catch((err) =>
        reportError("Recovery bundle sync after cloud backup", err),
      )
    }
  }, [
    password,
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
