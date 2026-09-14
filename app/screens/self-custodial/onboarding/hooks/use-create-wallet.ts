import { useCallback, useState } from "react"

import { CommonActions, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useProvisionSelfCustodialAccount } from "@app/self-custodial/hooks/use-provision-self-custodial-account"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { withSelfCustodialAccountMode } from "@app/store/persistent-state/self-custodial-account-mode"
import { AccountMode } from "@app/types/account"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

export const CreationStatus = {
  Idle: "idle",
  Creating: "creating",
  Error: "error",
} as const

type CreationStatus = (typeof CreationStatus)[keyof typeof CreationStatus]

export const useCreateWallet = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { updateState } = usePersistentStateContext()
  const { retry: reinitSdk } = useSelfCustodialWallet()
  const { provision } = useProvisionSelfCustodialAccount()
  const { LL } = useI18nContext()
  const [status, setStatus] = useState<CreationStatus>(CreationStatus.Idle)
  const guard = useInFlightGuard()

  const create = useCallback(
    async (mode?: AccountMode) => {
      await guard.run(async () => {
        setStatus(CreationStatus.Creating)
        try {
          const accountId = await provision()
          reinitSdk()
          /** The mode was chosen before the account existed; store it against the freshly
           *  provisioned id alongside making it active, in a single write. */
          updateState((prev) => {
            if (!prev) return prev
            const withActive = { ...prev, activeAccountId: accountId }
            return mode
              ? withSelfCustodialAccountMode(withActive, accountId, mode)
              : withActive
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
    },
    [guard, navigation, updateState, reinitSdk, provision, LL],
  )

  return { status, create }
}
