import { useEffect, useRef } from "react"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useCustodialWallet } from "@app/custodial/providers/wallet-provider"
import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet.types"

import { useAccountRegistry } from "./use-account-registry"

const createPlaceholder = (accountType: AccountType): ActiveWalletState => ({
  wallets: [],
  status: ActiveWalletStatus.Unavailable,
  accountType,
})

export const useActiveWallet = (): ActiveWalletState => {
  const { activeAccount, accounts, setActiveAccountId } = useAccountRegistry()
  const { nonCustodialEnabled } = useFeatureFlags()
  const custodialState = useCustodialWallet()
  const hasRolledBack = useRef(false)

  useEffect(() => {
    if (hasRolledBack.current) return
    if (nonCustodialEnabled) return
    if (activeAccount?.type !== AccountType.SelfCustodial) return

    const fallback = accounts.find((a) => a.type === AccountType.Custodial)
    if (!fallback) return

    hasRolledBack.current = true
    setActiveAccountId(fallback.id)
  }, [nonCustodialEnabled, activeAccount, accounts, setActiveAccountId])

  if (!activeAccount) return createPlaceholder(AccountType.Custodial)
  if (activeAccount.type === AccountType.Custodial) return custodialState
  return createPlaceholder(AccountType.SelfCustodial)
}
