import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { getSparkDriveBackupFilename } from "@app/config/appinfo"
import { useSelfCustodialAccountInfo } from "@app/self-custodial/hooks/use-self-custodial-account-info"
import { useBackupState } from "@app/self-custodial/providers/backup-state"
import { useAppConfig, useGoogleDriveBackup } from "@app/hooks"
import { useWalletMnemonic } from "@app/hooks/use-wallet-mnemonic"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { confirmDialog } from "@app/utils/confirm-dialog"
import {
  buildBackupPayload,
  type BackupMetadata,
  parseBackupMetadata,
} from "@app/utils/backup-payload"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

import { getCloudProviderName } from "../utils"

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
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { appConfig } = useAppConfig()
  const { startSession, upload, downloadById, loading } = useGoogleDriveBackup()
  const mnemonic = useWalletMnemonic()
  const { identityPubkey, lightningAddress } = useSelfCustodialAccountInfo()
  const { setBackupCompleted } = useBackupState()

  const handleBackup = useCallback(async () => {
    const provider = getCloudProviderName(LL)

    if (!identityPubkey) {
      toastShow({ message: LL.BackupScreen.CloudBackup.signInFailed(), LL })
      return
    }

    const filename = getSparkDriveBackupFilename(
      appConfig.galoyInstance.name,
      identityPubkey,
    )

    let session
    try {
      session = await startSession(filename)
    } catch (err) {
      reportError("Cloud backup sign-in", err)
      toastShow({ message: LL.BackupScreen.CloudBackup.signInFailed(), LL })
      return
    }

    if (session.existingFileId) {
      const downloadResult = await downloadById(
        session.existingFileId,
        session.accessToken,
      )
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

    setBackupCompleted("cloud")
    toastShow({
      message: LL.BackupScreen.CloudBackup.uploadSuccess({ provider }),
      type: "success",
      LL,
    })
    navigation.navigate("sparkBackupSuccessScreen")
  }, [
    isEncrypted,
    password,
    version,
    startSession,
    upload,
    downloadById,
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
