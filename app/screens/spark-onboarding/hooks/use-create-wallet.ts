import { useCallback, useState } from "react"
import Crypto from "react-native-quick-crypto"

import { CommonActions, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { selfCustodialCreateWallet } from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

export const CreationStatus = {
  Idle: "idle",
  Creating: "creating",
  Error: "error",
} as const

type CreationStatus = (typeof CreationStatus)[keyof typeof CreationStatus]

export const useCreateWallet = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { updateState } = usePersistentStateContext()
  const { retry: reinitSdk } = useSelfCustodialWallet()
  const { reloadSelfCustodialAccounts } = useAccountRegistry()
  const { LL } = useI18nContext()
  const [status, setStatus] = useState<CreationStatus>(CreationStatus.Idle)
  const guard = useInFlightGuard()

  const create = useCallback(async () => {
    await guard.run(async () => {
      setStatus(CreationStatus.Creating)
      try {
        const accountId = Crypto.randomUUID()
        await selfCustodialCreateWallet(accountId)
        await reloadSelfCustodialAccounts()
        reinitSdk()
        updateState((prev) => {
          if (!prev) return prev
          return { ...prev, activeAccountId: accountId }
        })
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
        )
      } catch (err) {
        reportError("Wallet creation", err)
        setStatus(CreationStatus.Error)
        toastShow({ message: LL.AccountTypeSelectionScreen.createFailed(), LL })
      }
    })
  }, [guard, navigation, updateState, reinitSdk, reloadSelfCustodialAccounts, LL])

  return { status, create }
}
