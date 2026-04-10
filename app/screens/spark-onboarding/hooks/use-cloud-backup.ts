import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import crashlytics from "@react-native-firebase/crashlytics"

import { getSparkDriveBackupFilename } from "@app/config/appinfo"
import { useBackupState } from "@app/self-custodial/providers/backup-state-provider"
import { useAppConfig, useGoogleDriveBackup } from "@app/hooks"
import { useWalletMnemonic } from "@app/hooks/use-wallet-mnemonic"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { confirmDialog } from "@app/utils/confirm-dialog"
import { buildBackupPayload } from "@app/utils/backup-payload"
import { toastShow } from "@app/utils/toast"

import { getCloudProviderName } from "../utils"

const DEFAULT_BACKUP_VERSION = 1

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
  const { startSession, upload, loading } = useGoogleDriveBackup()
  const mnemonic = useWalletMnemonic()
  const { setBackupCompleted } = useBackupState()

  const handleBackup = useCallback(async () => {
    const provider = getCloudProviderName(LL)

    const filename = getSparkDriveBackupFilename(appConfig.galoyInstance.name)

    let session
    try {
      session = await startSession(filename)
    } catch (err) {
      crashlytics().recordError(
        err instanceof Error ? err : new Error(`Cloud backup sign-in failed: ${err}`),
      )
      toastShow({ message: LL.BackupScreen.CloudBackup.signInFailed(), LL })
      return
    }

    if (session.existingFileId) {
      const confirmed = await confirmDialog({
        title: LL.BackupScreen.CloudBackup.existingBackupTitle(),
        message: LL.BackupScreen.CloudBackup.existingBackupMessage({ provider }),
        labels: {
          cancel: LL.common.cancel(),
          confirm: LL.BackupScreen.CloudBackup.overwrite(),
        },
      })
      if (!confirmed) return
    }

    const payload = buildBackupPayload(mnemonic, {
      password: isEncrypted ? password : undefined,
      version,
    })

    const result = await upload(payload, filename, session)
    if (!result.success) {
      crashlytics().recordError(new Error(`Cloud backup upload failed: ${result.error}`))
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
    navigation,
    LL,
    appConfig.galoyInstance.name,
    mnemonic,
    setBackupCompleted,
  ])

  return { handleBackup, loading }
}
