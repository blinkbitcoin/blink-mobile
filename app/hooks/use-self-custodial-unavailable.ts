import { useAccountRegistry } from "./use-account-registry"
import { useSelfCustodialRollback } from "./use-self-custodial-rollback"

export const useSelfCustodialUnavailable = (): boolean => {
  const { activeAccount, accounts, setActiveAccountId } = useAccountRegistry()
  const { shouldShowUnavailable } = useSelfCustodialRollback({
    activeAccount,
    accounts,
    setActiveAccountId,
  })
  return shouldShowUnavailable
}
