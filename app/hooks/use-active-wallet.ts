import { useCustodialWallet } from "@app/custodial/providers/wallet-provider"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import {
  AccountType,
  ActiveWalletStatus,
  type ActiveWalletState,
} from "@app/types/wallet.types"

import { useAccountRegistry } from "./use-account-registry"
import { useSelfCustodialRollback } from "./use-self-custodial-rollback"

const createPlaceholder = (accountType: AccountType): ActiveWalletState => ({
  wallets: [],
  status: ActiveWalletStatus.Unavailable,
  accountType,
})

export const useActiveWallet = (): ActiveWalletState => {
  const { activeAccount, accounts, setActiveAccountId } = useAccountRegistry()
  const custodialState = useCustodialWallet()
  const selfCustodialState = useSelfCustodialWallet()

  useSelfCustodialRollback({ activeAccount, accounts, setActiveAccountId })

  if (!activeAccount) return createPlaceholder(AccountType.Custodial)
  if (activeAccount.type === AccountType.Custodial) return custodialState
  return selfCustodialState
}
