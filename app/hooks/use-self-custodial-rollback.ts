import { useEffect } from "react"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { AccountType, type AccountDescriptor } from "@app/types/wallet.types"

type RollbackDeps = {
  activeAccount?: AccountDescriptor
  accounts: AccountDescriptor[]
  setActiveAccountId: (id: string) => void
}

export const useSelfCustodialRollback = ({
  activeAccount,
  accounts,
  setActiveAccountId,
}: RollbackDeps): void => {
  const { nonCustodialEnabled } = useFeatureFlags()

  useEffect(() => {
    if (nonCustodialEnabled) return
    if (activeAccount?.type !== AccountType.SelfCustodial) return

    const fallback = accounts.find((a) => a.type === AccountType.Custodial)
    if (!fallback) return

    setActiveAccountId(fallback.id)
  }, [nonCustodialEnabled, activeAccount, accounts, setActiveAccountId])
}
