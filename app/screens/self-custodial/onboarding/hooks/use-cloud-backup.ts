import { useCallback } from "react"
import { Platform } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { getCloudBackupFilename } from "@app/config/appinfo"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logSelfCustodialBackupCompleted } from "@app/self-custodial/analytics"
import { useSelfCustodialAccountInfo } from "@app/self-custodial/hooks/use-self-custodial-account-info"
import { BackupMethod, useBackupState } from "@app/self-custodial/providers/backup-state"
import { CloudBackupErrorReason } from "@app/types/cloud-backup"
import {
  buildBackupPayload,
  type BackupMetadata,
  parseBackupMetadata,
} from "@app/utils/backup-payload"
import { confirmDialog } from "@app/utils/confirm-dialog"
import { toastShow } from "@app/utils/toast"

import { getCloudProviderName } from "../utils"

import { usePlatformCloudBackup } from "./use-platform-cloud-backup"
import { useWalletMnemonic } from "./use-wallet-mnemonic"

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
  version?: number
}

export const useCloudBackup = ({
  isEncrypted,
  password,
  version = DEFAULT_BACKUP_VERSION,
}: UseCloudBackupParams) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { appConfig } = useAppConfig()
  const { startSession, upload, downloadById, resolveErrorMessage, loading } =
    usePlatformCloudBackup()
  const mnemonic = useWalletMnemonic()
  const { identityPubkey, lightningAddress } = useSelfCustodialAccountInfo()
  const { setBackupCompleted } = useBackupState()

  const handleBackup = useCallback(async () => {
    const provider = getCloudProviderName(LL)

    if (!identityPubkey) {
      toastShow({ message: LL.BackupScreen.CloudBackup.signInFailed({ provider }), LL })
      return
    }

    const filename = getCloudBackupFilename(appConfig.galoyInstance.name, identityPubkey)

    const sessionResult = await startSession(filename)
    if (!sessionResult.success) {
      toastShow({ message: resolveErrorMessage(sessionResult.reason, LL), LL })
      return
    }
    const { session } = sessionResult

    if (session.existingFileId) {
      const downloadResult = await downloadById(
        session.existingFileId,
        session.accessToken,
      )

      if (
        !downloadResult.success &&
        downloadResult.reason !== CloudBackupErrorReason.NotFound
      ) {
        toastShow({ message: LL.BackupScreen.CloudBackup.uploadFailed(), LL })
        return
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

    const result = await upload(payload, filename, session)
    if (!result.success) {
      toastShow({ message: LL.BackupScreen.CloudBackup.uploadFailed(), LL })
      return
    }

    setBackupCompleted(BackupMethod.Cloud)
    logSelfCustodialBackupCompleted({
      backupMethod: Platform.OS === "ios" ? "icloud" : "google_drive",
    })
    toastShow({
      message: LL.BackupScreen.CloudBackup.uploadSuccess({ provider }),
      type: "success",
      LL,
    })
    navigation.navigate("selfCustodialBackupSuccess")
  }, [
    isEncrypted,
    password,
    version,
    startSession,
    upload,
    downloadById,
    resolveErrorMessage,
    navigation,
    LL,
    appConfig.galoyInstance.name,
    mnemonic,
    identityPubkey,
    lightningAddress,
    setBackupCompleted,
  ])

  return { handleBackup, loading }
}
