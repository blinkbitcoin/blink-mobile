import { useAppConfig } from "@app/hooks"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { DefaultAccountId } from "@app/types/wallet.types"

// Empty token when self-custodial is active prevents custodial queries from
// leaking data into self-custodial mode (Apollo client is rebuilt without auth).
export const useEffectiveAuthToken = (): string => {
  const { appConfig } = useAppConfig()
  const { persistentState } = usePersistentStateContext()
  const { activeAccountId } = persistentState
  const activeIsCustodial =
    !activeAccountId || activeAccountId === DefaultAccountId.Custodial
  return activeIsCustodial ? appConfig.token : ""
}
