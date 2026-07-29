import { DefaultAccountId } from "@app/types/wallet"

import { PersistentState } from "./state-migrations"

/**
 * The active account's id when it is a self-custodial account, else null. Per-account
 * self-custodial preferences key on this, so custodial or no active account writes nothing.
 */
export const resolveActiveSelfCustodialId = (state: PersistentState): string | null => {
  const id = state.activeAccountId
  if (!id || id === DefaultAccountId.Custodial) return null
  return id
}
