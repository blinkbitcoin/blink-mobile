import { AuthenticationScreenPurpose, PinScreenPurpose } from "@app/utils/enum"

import { RootStackParamList } from "./stack-param-lists"

/**
 * The routes the unlock flow runs on, and the single source of truth for them: the unlock
 * screens type their own options against this list, and the armed migration gate reads it
 * to know which screen it must never tear down, so a fourth unlock step cannot be added to
 * one and forgotten in the other.
 */
const UNLOCK_ROUTE_NAMES = [
  "authenticationCheck",
  "authentication",
  "pin",
] as const satisfies readonly (keyof RootStackParamList)[]

export type UnlockRouteName = (typeof UNLOCK_ROUTE_NAMES)[number]

/**
 * Which `screenPurpose` means the route is unlocking, rather than one of the Settings jobs
 * that reuse the same screens to SET a PIN or turn biometrics on while the app is already
 * unlocked. Null is for the route that has no purpose to tell apart because unlocking is
 * all it ever does. Exhaustive on purpose: a route added above has no entry here and fails
 * to compile, so a new unlock step can never be classified by omission.
 */
const UNLOCK_PURPOSE_BY_ROUTE: Record<
  UnlockRouteName,
  AuthenticationScreenPurpose | PinScreenPurpose | null
> = {
  authenticationCheck: null,
  authentication: AuthenticationScreenPurpose.Authenticate,
  pin: PinScreenPurpose.AuthenticatePin,
}

const isUnlockRouteName = (name: string): name is UnlockRouteName =>
  UNLOCK_ROUTE_NAMES.some((unlockRoute) => unlockRoute === name)

/** Whether this route is an unlock the user is working through right now. Judged on the
 *  purpose and not the name alone, which would read someone setting a PIN in Settings as
 *  an unlock in progress. */
export const isUnlockInProgress = (route: { name: string; params?: object }): boolean => {
  if (!isUnlockRouteName(route.name)) return false

  const unlockPurpose = UNLOCK_PURPOSE_BY_ROUTE[route.name]
  if (unlockPurpose === null) return true

  const { screenPurpose } = (route.params ?? {}) as { screenPurpose?: string }
  return screenPurpose === unlockPurpose
}
