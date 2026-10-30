import jsSha256 from "js-sha256"

import { DefaultAccountId } from "@app/types/wallet"

import { PersistentState } from "./state-migrations"

type ActiveAccountState = Pick<PersistentState, "activeAccountId">

/**
 * Resolves the per-account map key for features that fall back to the custodial
 * slot when no self-custodial account is active. The write key and read key
 * must stay identical, so both sides resolve through this single primitive.
 */
export const resolveAccountKey = (state: ActiveAccountState): string =>
  state.activeAccountId ?? DefaultAccountId.Custodial

type SessionState = Pick<PersistentState, "galoyAuthToken" | "activeAccountId">

/**
 * Identifies the session the requests go out under: the token, as a digest so the
 * key keeps no credential alive, plus the profile it is used for, since a
 * self-custodial profile keeps the custodial token stored while it is active. Work
 * that must not cross a logout or a profile switch is keyed by this.
 */
export const resolveSessionKey = (state: SessionState): string =>
  `${jsSha256.sha256(state.galoyAuthToken)}:${resolveAccountKey(state)}`
