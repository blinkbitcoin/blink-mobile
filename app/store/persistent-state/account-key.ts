import { DefaultAccountId } from "@app/types/wallet"

import { PersistentState } from "./state-migrations"

/**
 * Resolves the per-account map key for features that fall back to the custodial
 * slot when no self-custodial account is active. The write key and read key
 * must stay identical, so both sides resolve through this single primitive.
 */
export const resolveAccountKey = (state: PersistentState): string =>
  state.activeAccountId ?? DefaultAccountId.Custodial
