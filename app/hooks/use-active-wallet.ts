import { useMemo } from "react"

import { useCustodialWallet } from "@app/custodial/providers/wallet"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { useSelfCustodialRollback } from "@app/self-custodial/hooks/use-rollback"
import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet"

import { useAccountRegistry } from "./use-account-registry"

type ActiveWalletResult = ActiveWalletState & {
  isReady: boolean
  isSelfCustodial: boolean
  needsBackendAuth: boolean
}

const createPlaceholder = (accountType: AccountType): ActiveWalletState => ({
  wallets: [],
  status: ActiveWalletStatus.Unavailable,
  accountType,
})

const resolveBaseState = (
  activeAccount: { type: AccountType } | undefined,
  custodialState: ActiveWalletState,
  selfCustodialState: ActiveWalletState,
): ActiveWalletState => {
  if (!activeAccount) return createPlaceholder(AccountType.Custodial)
  if (activeAccount.type === AccountType.Custodial) return custodialState
  return selfCustodialState
}

export const useActiveWallet = (): ActiveWalletResult => {
  const { activeAccount, accounts, setActiveAccountId } = useAccountRegistry()
  const custodialState = useCustodialWallet()
  const selfCustodialState = useSelfCustodialWallet()

  useSelfCustodialRollback({ activeAccount, accounts, setActiveAccountId })

  return useMemo(() => {
    const base = resolveBaseState(activeAccount, custodialState, selfCustodialState)

    return {
      ...base,
      isReady:
        base.status === ActiveWalletStatus.Ready ||
        base.status === ActiveWalletStatus.Degraded,
      isSelfCustodial:
        base.accountType === AccountType.SelfCustodial &&
        base.status !== ActiveWalletStatus.Unavailable,
      needsBackendAuth: base.accountType === AccountType.Custodial,
    }
  }, [activeAccount, custodialState, selfCustodialState])
}
