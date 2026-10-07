import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import useLogout from "./use-logout"
import { useReturnToGate } from "./use-return-to-gate"

type LogoutOptions = Parameters<ReturnType<typeof useLogout>["logout"]>[0]

type UseLogoutAndRoute = {
  /** A full logout and the way out it earns, in one call. For every caller that can route
   *  the moment the logout returns. */
  logoutAndRoute: (options?: LogoutOptions) => Promise<void>
  /** The same way out, for the callers that cannot take it yet: one routing from inside a
   *  dialog's callback has to carry the answer there rather than act on it here. */
  routeAfterLogout: (isAppLockKept: boolean) => void
}

/**
 * Where a finished full logout is allowed to land.
 *
 * A logout keeps the app lock for as long as the device still stores something it guards,
 * and a kept lock is one still owed an answer: the landing screen is not where such a
 * logout may end, because it opens an account and any account lists every wallet the
 * device holds. The gate asks again, and it is the gate that hands a device with nothing
 * left to unlock on to the landing screen.
 *
 * The rule lives here, once, because it was the duplication that broke it: every full
 * logout call site repeated the route, and the ones that were written before the lock could
 * outlive a logout kept routing straight to the landing screen and walked the lock away.
 *
 * `logout` itself stays free of routing on purpose. Most of its callers pass a token and
 * are scoped to that one session, which ends no session the lock is guarding and must not
 * move the user at all.
 */
export const useLogoutAndRoute = (): UseLogoutAndRoute => {
  const { logout } = useLogout()
  const returnToGate = useReturnToGate()
  const { setAppUnlocked } = useAuthenticationContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const routeAfterLogout = useCallback(
    (isAppLockKept: boolean): void => {
      if (isAppLockKept) {
        returnToGate()
        return
      }

      /**
       * Straight to the landing screen with the lock gone: there is nothing left for the
       * gate to ask, and asking anyway would take away the way out it promises.
       *
       * The flag goes down with the lock. Left up, the app would never relock on resume
       * and every payment link would stay parked behind it.
       */
      setAppUnlocked()
      navigation.reset({ index: 0, routes: [{ name: "getStarted" }] })
    },
    [returnToGate, setAppUnlocked, navigation],
  )

  const logoutAndRoute = useCallback(
    async (options?: LogoutOptions): Promise<void> => {
      const { isAppLockKept } = await logout(options)
      routeAfterLogout(isAppLockKept)
    },
    [logout, routeAfterLogout],
  )

  return { logoutAndRoute, routeAfterLogout }
}
