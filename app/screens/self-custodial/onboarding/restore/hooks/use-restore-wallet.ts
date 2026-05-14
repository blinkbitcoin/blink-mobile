import { useCallback, useState } from "react"
import { validateMnemonic } from "bip39"
import Crypto from "react-native-quick-crypto"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { selfCustodialRestoreWallet } from "@app/self-custodial/bridge"
import {
  BackupMethod,
  markBackupCompletedFor,
} from "@app/self-custodial/providers/backup-state"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import {
  findSelfCustodialAccountByMnemonic,
  StorageReadStatus,
} from "@app/self-custodial/storage/account-index"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { logSelfCustodialRestoreCompleted } from "@app/utils/analytics"
import { reportError } from "@app/utils/error-logging"
import { normalizeMnemonic } from "@app/utils/mnemonic"
import { toastShow } from "@app/utils/toast"

const RestoreWalletStatus = {
  Idle: "idle",
  Restoring: "restoring",
  Error: "error",
} as const

type RestoreWalletStatus = (typeof RestoreWalletStatus)[keyof typeof RestoreWalletStatus]

export const useRestoreWallet = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { updateState } = usePersistentStateContext()
  const { retry: reinitSdk } = useSelfCustodialWallet()
  const { reloadSelfCustodialAccounts } = useAccountRegistry()
  const [status, setStatus] = useState<RestoreWalletStatus>(RestoreWalletStatus.Idle)
  const guard = useInFlightGuard()

  const activateAccount = useCallback(
    (accountId: string) => {
      updateState((prev) => {
        if (!prev) return prev
        return { ...prev, activeAccountId: accountId }
      })
    },
    [updateState],
  )

  const restore = useCallback(
    async (mnemonic: string) => {
      await guard.run(async () => {
        setStatus(RestoreWalletStatus.Restoring)

        const normalized = normalizeMnemonic(mnemonic)
        if (!validateMnemonic(normalized)) {
          setStatus(RestoreWalletStatus.Error)
          toastShow({ message: LL.RestoreScreen.invalidMnemonic(), LL })
          return
        }

        try {
          const lookup = await findSelfCustodialAccountByMnemonic(normalized)
          if (lookup.status === StorageReadStatus.ReadFailed) throw lookup.error

          if (lookup.id) {
            activateAccount(lookup.id)
            reinitSdk()
            navigation.navigate("selfCustodialBackupSuccess")
            return
          }

          const accountId = Crypto.randomUUID()
          await selfCustodialRestoreWallet(accountId, normalized)
          await markBackupCompletedFor(accountId, BackupMethod.Manual)
          await reloadSelfCustodialAccounts()

          activateAccount(accountId)
          reinitSdk()
          logSelfCustodialRestoreCompleted()
          navigation.navigate("selfCustodialBackupSuccess")
        } catch (err) {
          reportError("Wallet restore", err)
          setStatus(RestoreWalletStatus.Error)
          toastShow({ message: LL.RestoreScreen.restoreFailed(), LL })
          throw err
        }
      })
    },
    [guard, activateAccount, reinitSdk, reloadSelfCustodialAccounts, navigation, LL],
  )

  return { restore, status }
}

export { RestoreWalletStatus }
