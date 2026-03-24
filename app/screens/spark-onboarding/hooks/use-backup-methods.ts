import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { SPARK_KEYCHAIN_SERVICE } from "@app/config/appinfo"
import { useKeychainBackup } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toastShow } from "@app/utils/toast"

import { MOCK_WORDS } from "../spark-mock-data"

export const useBackupMethods = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { save: saveToKeychain, loading: keychainLoading } =
    useKeychainBackup(SPARK_KEYCHAIN_SERVICE)

  const handleKeychainBackup = useCallback(async () => {
    const success = await saveToKeychain(MOCK_WORDS.join(" "))
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
  }, [saveToKeychain, navigation, LL])

  const handleManualBackup = useCallback(() => {
    navigation.navigate("sparkBackupAlertsScreen")
  }, [navigation])

  return {
    keychainLoading,
    handleKeychainBackup,
    handleManualBackup,
  }
}
