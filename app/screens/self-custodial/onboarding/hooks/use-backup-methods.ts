import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logSelfCustodialBackupCompleted } from "@app/self-custodial/analytics"
import { useSelfCustodialAccountInfo } from "@app/self-custodial/hooks/use-self-custodial-account-info"
import { BackupMethod, useBackupState } from "@app/self-custodial/providers/backup-state"
import { toastShow } from "@app/utils/toast"

import {
  CredentialError,
  isCredentialBackupAvailable,
  useCredentialBackup,
} from "./use-credential-backup"
import { useWalletMnemonic } from "./use-wallet-mnemonic"

const showBackupErrorToast = (error: CredentialError, LL: TranslationFunctions): void => {
  switch (error) {
    case CredentialError.UserCancelled:
      return
    case CredentialError.NoProvider:
    case CredentialError.Unsupported:
      toastShow({
        message: LL.BackupScreen.BackupMethod.passwordManagerUnavailable(),
        LL,
      })
      return
    case CredentialError.Unknown:
      toastShow({
        message: LL.BackupScreen.BackupMethod.passwordManagerBackupFailed(),
        LL,
      })
      return
    default: {
      const _exhaustive: never = error
      throw new Error(`Unknown credential error: ${_exhaustive}`)
    }
  }
}

export const useBackupMethods = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const mnemonic = useWalletMnemonic()
  const { identityPubkey } = useSelfCustodialAccountInfo()
  const { setBackupCompleted } = useBackupState()
  const { selfCustodialEntries } = useAccountRegistry()
  const credentialBackupAvailable = isCredentialBackupAvailable(
    selfCustodialEntries.length,
  )

  const { save, loading: credentialLoading } = useCredentialBackup()

  const handleCredentialBackup = useCallback(async () => {
    if (!identityPubkey) {
      toastShow({
        message: LL.BackupScreen.BackupMethod.passwordManagerBackupFailed(),
        LL,
      })
      return
    }

    const result = await save(identityPubkey, mnemonic)
    if (!result.success) {
      showBackupErrorToast(result.error, LL)
      return
    }

    setBackupCompleted(BackupMethod.Keychain)
    logSelfCustodialBackupCompleted({ backupMethod: "keychain" })
    toastShow({
      message: LL.BackupScreen.BackupMethod.passwordManagerBackupSaved(),
      type: "success",
      LL,
    })
    navigation.navigate("selfCustodialBackupSuccess")
  }, [save, navigation, LL, mnemonic, identityPubkey, setBackupCompleted])

  const handleCloudBackup = useCallback(() => {
    navigation.navigate("selfCustodialCloudBackup")
  }, [navigation])

  const handleManualBackup = useCallback(() => {
    navigation.navigate("selfCustodialBackupSecurityChecks")
  }, [navigation])

  return {
    isCredentialBackupAvailable: credentialBackupAvailable,
    credentialLoading,
    handleCredentialBackup,
    handleCloudBackup,
    handleManualBackup,
  }
}
