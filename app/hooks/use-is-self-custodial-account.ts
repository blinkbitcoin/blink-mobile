import { AccountType } from "@app/types/wallet"

import { useActiveWallet } from "./use-active-wallet"

/**
 * Whether the active account is self-custodial, regardless of what its wallet is
 * doing. Prefer `useActiveWallet().isSelfCustodial` for anything that touches
 * funds — it additionally requires a usable wallet. Use this one for features
 * that only need to know which kind of account is signed in, so they keep
 * working while the SDK is loading or the account still needs restoring.
 */
export const useIsSelfCustodialAccount = (): boolean => {
  const { accountType } = useActiveWallet()
  return accountType === AccountType.SelfCustodial
}
