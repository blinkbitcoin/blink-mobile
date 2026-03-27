import { useCallback } from "react"
import { Alert } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { getSparkDriveBackupFilename } from "@app/config/appinfo"
import { useAppConfig, useGoogleDriveBackup } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { deriveKeyFromPassword, encryptAesGcm } from "@app/utils/crypto"
import { toastShow } from "@app/utils/toast"

import { MOCK_WORDS } from "../spark-mock-data"
import { getCloudProviderName } from "../utils"

const DEFAULT_BACKUP_VERSION = 1

type UseCloudBackupParams = {
  isEncrypted: boolean
  password: string
  version?: number
}

type OverwriteAlertParams = {
  title: string
  message: string
  labels: { cancel: string; overwrite: string }
}

const confirmOverwrite = ({
  title,
  message,
  labels,
}: OverwriteAlertParams): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: labels.cancel, style: "cancel", onPress: () => resolve(false) },
      { text: labels.overwrite, style: "destructive", onPress: () => resolve(true) },
    ])
  })

export const useCloudBackup = ({
  isEncrypted,
  password,
  version = DEFAULT_BACKUP_VERSION,
}: UseCloudBackupParams) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { appConfig } = useAppConfig()
  const { startSession, upload, loading } = useGoogleDriveBackup()

  const handleBackup = useCallback(async () => {
    const provider = getCloudProviderName(LL)

    const filename = getSparkDriveBackupFilename(appConfig.galoyInstance.name)

    let session
    try {
      session = await startSession(filename)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : LL.SparkOnboarding.CloudBackup.signInFailed()
      toastShow({ message, LL })
      return
    }

    if (session.existingFileId) {
      const confirmed = await confirmOverwrite({
        title: LL.SparkOnboarding.CloudBackup.existingBackupTitle(),
        message: LL.SparkOnboarding.CloudBackup.existingBackupMessage({ provider }),
        labels: {
          cancel: LL.common.cancel(),
          overwrite: LL.SparkOnboarding.CloudBackup.overwrite(),
        },
      })
      if (!confirmed) return
    }

    const mnemonic = MOCK_WORDS.join(" ")
    const base = { version, createdAt: Date.now() }

    const payload = isEncrypted
      ? (() => {
          const { key, salt } = deriveKeyFromPassword(password)
          const { data, iv } = encryptAesGcm(mnemonic, key)
          return JSON.stringify({ ...base, encrypted: true, data, iv, salt })
        })()
      : JSON.stringify({ ...base, encrypted: false, mnemonic })

    const result = await upload(payload, filename, session)
    if (!result.success) {
      toastShow({ message: result.error, LL })
      return
    }

    toastShow({
      message: LL.SparkOnboarding.CloudBackup.uploadSuccess({ provider }),
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
  ])

  return { handleBackup, loading }
}
