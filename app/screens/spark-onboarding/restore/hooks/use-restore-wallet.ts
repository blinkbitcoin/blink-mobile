import { useCallback, useState } from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import crashlytics from "@react-native-firebase/crashlytics"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { selfCustodialRestoreWallet } from "@app/self-custodial/bridge"
import { useBackupState } from "@app/self-custodial/providers/backup-state-provider"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { DefaultAccountId } from "@app/types/wallet.types"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { toastShow } from "@app/utils/toast"

const RestoreWalletStatus = {
  Idle: "idle",
  Restoring: "restoring",
  Error: "error",
} as const

type RestoreWalletStatus = (typeof RestoreWalletStatus)[keyof typeof RestoreWalletStatus]

const reportError = (err: unknown): void => {
  crashlytics().recordError(
    err instanceof Error ? err : new Error(`Wallet restore failed: ${err}`),
  )
}

export const useRestoreWallet = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { updateState } = usePersistentStateContext()
  const { retry: reinitSdk } = useSelfCustodialWallet()
  const { resetBackupState } = useBackupState()
  const [status, setStatus] = useState<RestoreWalletStatus>(RestoreWalletStatus.Idle)

  const activateAccount = useCallback(() => {
    updateState((prev) => {
      if (!prev) return prev
      return { ...prev, activeAccountId: DefaultAccountId.SelfCustodial }
    })
  }, [updateState])

  const restore = useCallback(
    async (mnemonic: string) => {
      setStatus(RestoreWalletStatus.Restoring)
      try {
        await selfCustodialRestoreWallet(mnemonic)
        activateAccount()
        reinitSdk()
        resetBackupState()
        navigation.navigate("sparkBackupSuccessScreen")
      } catch (err) {
        await KeyStoreWrapper.deleteMnemonic().catch(() => {})
        reportError(err)
        setStatus(RestoreWalletStatus.Error)
        toastShow({ message: LL.RestoreScreen.restoreFailed(), LL })
        throw err
      }
    },
    [activateAccount, reinitSdk, navigation, LL],
  )

  return { restore, status }
}

export { RestoreWalletStatus }
