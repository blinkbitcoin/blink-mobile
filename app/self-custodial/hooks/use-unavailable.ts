import { useAccountRegistry } from "@app/hooks/use-account-registry"

import { useSelfCustodialRollback } from "./use-rollback"

export const useSelfCustodialUnavailable = (): boolean => {
  const { activeAccount, accounts, setActiveAccountId } = useAccountRegistry()
  const { shouldShowUnavailable } = useSelfCustodialRollback({
    activeAccount,
    accounts,
    setActiveAccountId,
  })
  return shouldShowUnavailable
}
