import { useMemo } from "react"

import { useCustodialWallet } from "@app/custodial/providers/wallet-provider"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet.types"

import { useAccountRegistry } from "./use-account-registry"
import { useSelfCustodialRollback } from "./use-self-custodial-rollback"

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

export const useActiveWallet = (): ActiveWalletResult => {
  const { activeAccount, accounts, setActiveAccountId } = useAccountRegistry()
  const custodialState = useCustodialWallet()
  const selfCustodialState = useSelfCustodialWallet()

  useSelfCustodialRollback({ activeAccount, accounts, setActiveAccountId })

  return useMemo(() => {
    const base = activeAccount
      ? activeAccount.type === AccountType.Custodial
        ? custodialState
        : selfCustodialState
      : createPlaceholder(AccountType.Custodial)

    return {
      ...base,
      isReady: base.status === ActiveWalletStatus.Ready,
      isSelfCustodial:
        base.accountType === AccountType.SelfCustodial &&
        base.status !== ActiveWalletStatus.Unavailable,
      needsBackendAuth: base.accountType === AccountType.Custodial,
    }
  }, [activeAccount, custodialState, selfCustodialState])
}
