import { useCallback } from "react"
import { Platform } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { getSparkKeychainService } from "@app/config/appinfo"
import { useAppConfig, useKeychainBackup } from "@app/hooks"
import { useWalletMnemonic } from "@app/hooks/use-wallet-mnemonic"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"

export const useBackupMethods = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { appConfig } = useAppConfig()
  const mnemonic = useWalletMnemonic()
  const isCloudBackupAvailable = Platform.OS !== "ios"

  const { save: saveToKeychain, loading: keychainLoading } = useKeychainBackup(
    getSparkKeychainService(appConfig.galoyInstance.name),
  )

  const handleKeychainBackup = useCallback(async () => {
    const success = await saveToKeychain(mnemonic)
    if (!success) {
      toastShow({
        message: LL.SparkOnboarding.BackupMethod.keychainFailed(),
        LL,
      })
      return
    }

    toastShow({
      message: LL.SparkOnboarding.BackupMethod.keychainSaved(),
      type: "success",
      LL,
    })
    navigation.navigate("sparkBackupSuccessScreen")
  }, [saveToKeychain, navigation, LL, mnemonic])

  const handleCloudBackup = useCallback(() => {
    if (!isCloudBackupAvailable) {
      toastShow({
        message: LL.SparkOnboarding.BackupMethod.iOSComingSoon(),
        LL,
      })
      return
    }
    navigation.navigate("sparkCloudBackupScreen")
  }, [isCloudBackupAvailable, navigation, LL])

  const handleManualBackup = useCallback(() => {
    navigation.navigate("sparkBackupAlertsScreen")
  }, [navigation])

  return {
    isCloudBackupAvailable,
    keychainLoading,
    handleKeychainBackup,
    handleCloudBackup,
    handleManualBackup,
  }
}
