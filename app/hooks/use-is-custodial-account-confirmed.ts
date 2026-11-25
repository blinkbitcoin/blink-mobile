import { AccountType } from "@app/types/wallet"

import { useAccountRegistry } from "./use-account-registry"

/**
 * Whether the selected account is known to be custodial: the registry has settled and
 * its selection resolves to a custodial account. It fails closed, false while the
 * registry is still loading or when the persisted selection matches no loaded account,
 * for decisions that must not treat an unknown account as custodial.
 * `useActiveWallet()` falls back to a custodial placeholder for a missing account.
 */
export const useIsCustodialAccountConfirmed = (): boolean => {
  const { activeAccount, loading } = useAccountRegistry()
  return !loading && activeAccount?.type === AccountType.Custodial
}
