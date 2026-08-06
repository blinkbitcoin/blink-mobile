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
      // Encodes SDK availability, not just account type: false whenever the
      // status is Unavailable — the initial renders at cold start or right
      // after an account switch (before the SDK lifecycle effect commits
      // Loading), and when no mnemonic exists. To ask "is the active account
      // self-custodial?", branch on
      // `useAccountRegistry().activeAccount?.type === AccountType.SelfCustodial`
      // instead (see use-price-conversion / use-pending-receive-amount).
      isSelfCustodial:
        base.accountType === AccountType.SelfCustodial &&
        base.status !== ActiveWalletStatus.Unavailable,
      needsBackendAuth: base.accountType === AccountType.Custodial,
    }
  }, [activeAccount, custodialState, selfCustodialState])
}
