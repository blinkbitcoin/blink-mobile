import * as React from "react"
import { useCallback, useEffect, useRef } from "react"
import { Linking } from "react-native"
import RNBootSplash from "react-native-bootsplash"

import analytics from "@react-native-firebase/analytics"
import {
  createNavigationContainerRef,
  LinkingOptions,
  NavigationContainer,
  NavigationState,
  PartialState,
  DarkTheme,
} from "@react-navigation/native"
import { useTheme } from "@rn-vui/themed"

import { Action, useActionsContext } from "@app/components/actions"
import { PREFIX_LINKING, TELEGRAM_CALLBACK_PATH } from "@app/config"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useMigrationBlocker } from "@app/screens/account-migration/hooks/use-migration-blocker"

import { DEEP_LINK_SCREENS } from "./deep-link-screens"
import { isMigrationRoute } from "./migration-routes"
import { RootStackParamList } from "./stack-param-lists"
import { isUnlockInProgress } from "./unlock-routes"

const navigationRef = createNavigationContainerRef<RootStackParamList>()

/** The one deeplink the account-closed gate still allows through: the migration entry. */
const MIGRATION_DEEPLINK_PATH = "account-migration"

/** Matches the migration entry by its path SEGMENT, not a loose substring: a crafted link
 *  like `blink://home?x=account-migration` must not slip past the armed-gate guard. An
 *  unparseable url is treated as non-migration, so it stays blocked while the gate is armed. */
export const isMigrationDeeplink = (url: string): boolean => {
  try {
    const { hostname, pathname } = new URL(url)
    const segment = pathname.replace(/^\/+|\/+$/g, "") || hostname
    return segment === MIGRATION_DEEPLINK_PATH
  } catch {
    return false
  }
}

/** Where the blocker lives: PrimaryNavigator swaps its tabs for the gate. */
const BLOCKER_ROUTE = "Primary" satisfies keyof RootStackParamList

/** Where a still-locked session has to pass through first. */
const UNLOCK_ENTRY_ROUTE = "authenticationCheck" satisfies keyof RootStackParamList

/** The armed-gate reset is lock-aware: while the app is still locked it must land on
 *  authenticationCheck so the PIN/biometric unlock is never skipped. Jumping straight to
 *  Primary would strand isAppLocked at true, hiding the gate behind an app that never
 *  unlocked and freezing the queued migration deeplink (which waits on !isAppLocked). Once
 *  unlocked, Primary is correct: the blocker renders the gate with no jarring re-prompt. */
export const blockerEntryRoute = (mustRouteThroughUnlock: boolean) =>
  mustRouteThroughUnlock ? UNLOCK_ENTRY_ROUTE : BLOCKER_ROUTE

/** The route the user is looking at, which is the only one an unlock can be blocking from,
 *  read off the state's own index rather than the tail of the list. */
const focusedRoute = (state: NavigationState | undefined) =>
  state ? state.routes[state.index] : undefined

/**
 * Whether resetting this stack would achieve anything. Two separate jobs qualify: popping
 * whatever is stacked on top of the blocker, and routing a session that is still locked
 * through the unlock entry, which is the only thing that lowers the lock and so the only
 * thing that drains the queued deeplink. A stack the blocker is not part of at all belongs
 * to another flow — signing in, unlocking, the landing screen a logout returns to — which
 * runs nothing over the closed account and reaches the blocker on its own.
 */
const isResetWarranted = (
  state: NavigationState | undefined,
  canResetOnLockAlone: boolean,
): boolean => {
  const routes = state?.routes ?? []
  const blockerIndex = routes.findIndex((route) => route.name === BLOCKER_ROUTE)
  if (blockerIndex === -1) return false

  const hasRoutesAboveBlocker = blockerIndex < routes.length - 1
  return hasRoutesAboveBlocker || canResetOnLockAlone
}

/** Why the stack is being judged. The triggers differ on WHETHER a reset is owed, not on
 *  where one lands: arming owns both of the jobs above, while a retry exists only to finish
 *  the pop an unlock stood in front of, so it must not reset a session it finds already at
 *  the blocker on the strength of a lock its own flow never lowered (the three-strikes
 *  logout resets the stack without unlocking). Where a reset that IS owed lands is the
 *  lock's call and no trigger's: see mustRouteThroughUnlock below. */
type ResetTrigger = "gate-armed" | "unlock-cleared"

export type AuthenticationContextType = {
  isAppLocked: boolean
  setAppUnlocked: () => void
  setAppLocked: () => void
}

// The initial value will never be null because the provider will always pass a non null value
// eslint-disable-next-line
// @ts-ignore
const AuthenticationContext = React.createContext<AuthenticationContextType>(null)

export const AuthenticationContextProvider = AuthenticationContext.Provider

export const useAuthenticationContext = () => React.useContext(AuthenticationContext)

export const processLinkForAction = (url: string): Action | null => {
  // grab action query param
  const urlObj = new URL(url)
  const action = urlObj.searchParams.get("action")

  switch ((action || "").toLocaleLowerCase()) {
    case "set-ln-address":
      return Action.SetLnAddress
    case "set-default-account":
      return Action.SetDefaultAccount
    case "upgrade-account":
      return Action.UpgradeAccount
  }
  return null
}

export const NavigationContainerWrapper: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const isAuthed = useIsAuthed()
  const { isSelfCustodial } = useActiveWallet()
  const canHandlePayments = isAuthed || isSelfCustodial
  const [isAppLocked, setIsAppLocked] = React.useState(true)
  const [urlAfterUnlockAndAuth, setUrlAfterUnlockAndAuth] = React.useState<string | null>(
    null,
  )
  const { setActiveAction } = useActionsContext()

  /** Keyed on the blocker's own visibility, not the raw armed status: when the kill-switch
   *  hides the blocker the app functions normally, so payment deeplinks must keep working
   *  and the stack must not be reset out from under the user. The linking listener closes
   *  over stale values, so this lives in a ref kept current by the effect below. */
  const isBlockerVisible = useMigrationBlocker().isVisible
  const isBlockerVisibleRef = useRef(isBlockerVisible)
  useEffect(() => {
    isBlockerVisibleRef.current = isBlockerVisible
  }, [isBlockerVisible])

  /** Mirrors the lock for the readers that run outside a render: the state is a commit
   *  behind, and the retry below runs during a navigation dispatch, before that commit
   *  lands. Written by the two setters so it is never the stale one. */
  const isAppLockedRef = useRef(isAppLocked)

  /** Set when the reset found an unlock in front of it, so it retries instead of being
   *  lost. Cleared by the next attempt that finds the way clear. */
  const isResetDeferredRef = useRef(false)

  /** Pop anything a deeplink opened above the blocker so nothing keeps working over the
   *  closed account, landing on the lock-aware entry so no reset ever skips the unlock.
   *  An unlock already on screen is the one thing it will not do that to: resetting there
   *  tore the screen down mid-PIN and served an identical empty one (#4150). */
  const resetToBlocker = useCallback((trigger: ResetTrigger) => {
    /** Guarded here rather than at each caller: the retry below fires on navigations the
     *  kill-switch may have made harmless in the meantime. A deferral does not outlive the
     *  blocker it was waiting for, or a re-arming would inherit a verdict about a stack
     *  that has since moved on. Readiness is different: it is transient, and onReady runs
     *  the arming again, so a deferral survives it. */
    if (!isBlockerVisibleRef.current) {
      isResetDeferredRef.current = false
      return
    }
    if (!navigationRef.isReady()) return

    const rootState = navigationRef.getRootState()
    const routeInFront = focusedRoute(rootState)
    if (!routeInFront) return

    const isArming = trigger === "gate-armed"

    /** Resetting a stack with nothing above the blocker, purely to route a locked session
     *  through the unlock, is arming's job alone. A retry doing it would bounce the
     *  three-strikes logout, which resets to the blocker itself without ever unlocking,
     *  back onto a PIN its own flow never owed.
     *
     *  Judged before the unlock is: a reset that would achieve nothing has nothing to come
     *  back for either, so it must not leave a retry armed behind it. */
    const canResetOnLockAlone = isAppLockedRef.current && isArming
    if (!isResetWarranted(rootState, canResetOnLockAlone)) {
      isResetDeferredRef.current = false
      return
    }

    isResetDeferredRef.current = isUnlockInProgress(routeInFront)
    if (isResetDeferredRef.current) return

    /** Where a reset that is owed lands is the lock's call, whichever trigger asked for it.
     *  Deriving this from the trigger let a retry land on Primary with the lock still up:
     *  the gate, mounted under the unlock screen, navigates to its resume target, which
     *  fires the pending retry, which then tore the unlock down and skipped the PIN
     *  entirely, stranding isAppLocked at true and freezing the queued migration deeplink
     *  (which waits on !isAppLocked). */
    const mustRouteThroughUnlock = isAppLockedRef.current

    /** A screen the armed gate opened rides along rather than being popped with the rest,
     *  so the pop that was owed does not throw away the gate's own choice and leave it to
     *  navigate there again from a fresh mount. Never above an unlock, which anything
     *  stacked over it would skip; the gate reopens it once the unlock steps aside. */
    const isOnGateOpenedScreen = !isArming && isMigrationRoute(routeInFront.name)
    const shouldPreserveGateScreen = isOnGateOpenedScreen && !mustRouteThroughUnlock

    const entryRoute = { name: blockerEntryRoute(mustRouteThroughUnlock) }
    const preservedRoute = { name: routeInFront.name, params: routeInFront.params }
    const routes = shouldPreserveGateScreen ? [entryRoute, preservedRoute] : [entryRoute]

    /** Preserving can leave nothing to pop: a gate screen sitting directly on the blocker
     *  already IS the stack this would lay down, and dispatching it anyway would remount
     *  the screen and restart whatever it had in flight. */
    const routesInStack = rootState?.routes ?? []
    const isStackAlreadyReset =
      routesInStack.length === routes.length &&
      routesInStack.every((route, index) => route.name === routes[index].name)
    if (isStackAlreadyReset) return

    navigationRef.reset({ index: routes.length - 1, routes })
  }, [])

  /** Covers arming mid-session. The container-not-ready-yet case (armed at cold start) is
   *  handled from onReady below, since this effect can fire before isReady() is true. */
  useEffect(() => {
    if (!isBlockerVisible) return
    resetToBlocker("gate-armed")
  }, [isBlockerVisible, resetToBlocker])

  useEffect(() => {
    if (canHandlePayments && !isAppLocked && urlAfterUnlockAndAuth) {
      Linking.openURL(urlAfterUnlockAndAuth)
      setUrlAfterUnlockAndAuth(null)
    }
  }, [canHandlePayments, isAppLocked, urlAfterUnlockAndAuth])

  const setAppUnlocked = React.useMemo(
    () => async () => {
      isAppLockedRef.current = false
      setIsAppLocked(false)
    },
    [],
  )

  const setAppLocked = React.useMemo(
    () => () => {
      isAppLockedRef.current = true
      setIsAppLocked(true)
    },
    [],
  )

  const routeName = useRef("Initial")

  const {
    theme: { mode },
  } = useTheme()

  const getActiveRouteName = (
    state: NavigationState | PartialState<NavigationState> | undefined,
  ): string => {
    if (!state || typeof state.index !== "number") {
      return "Unknown"
    }

    const route = state.routes[state.index]

    if (route.state) {
      return getActiveRouteName(route.state)
    }

    return route.name
  }

  const linking: LinkingOptions<RootStackParamList> = {
    prefixes: [
      ...PREFIX_LINKING,
      "bitcoin://",
      "lightning://",
      "lapp://",
      "lnurlw://",
      "lnurlp://",
      "lnurl://",
    ],
    config: {
      screens: DEEP_LINK_SCREENS,
    },
    getInitialURL: async () => {
      const url = await Linking.getInitialURL()
      setUrlAfterUnlockAndAuth(url)
      return null
    },
    subscribe: (listener) => {
      const onReceiveURL = ({ url }: { url: string }) => {
        if (url.includes(TELEGRAM_CALLBACK_PATH)) return

        /** With the account-closed gate armed, only the migration deeplink is honoured; any
         *  other would open a working screen on top of the blocker, so it is dropped. */
        if (isBlockerVisibleRef.current && !isMigrationDeeplink(url)) return

        if (!isAppLocked && canHandlePayments) {
          const maybeAction = processLinkForAction(url)
          if (maybeAction) {
            setActiveAction(maybeAction)
          }
          listener(url)
        } else {
          setUrlAfterUnlockAndAuth(url)
        }
      }
      // Listen to incoming links from deep linking
      const subscription = Linking.addEventListener("url", onReceiveURL)

      return () => {
        // Clean up the event listeners
        subscription.remove()
      }
    },
  }

  return (
    <AuthenticationContextProvider value={{ isAppLocked, setAppUnlocked, setAppLocked }}>
      <NavigationContainer
        ref={navigationRef}
        {...(mode === "dark" ? { theme: DarkTheme } : {})}
        linking={linking}
        onReady={() => {
          RNBootSplash.hide({ fade: true })
          console.log("NavigationContainer onReady")
          /** Cold-started already gated: reset now that the container is ready, since the
           *  effect above may have run before isReady() turned true. */
          if (isBlockerVisibleRef.current) resetToBlocker("gate-armed")
        }}
        onStateChange={(state) => {
          const currentRouteName = getActiveRouteName(state)

          if (routeName.current !== currentRouteName && currentRouteName) {
            /* eslint-disable camelcase */
            analytics().logScreenView({
              screen_name: currentRouteName,
              screen_class: currentRouteName,
              is_manual_log: true,
            })
            routeName.current = currentRouteName
          }

          /** A reset an unlock held back retries on every navigation until the way is
           *  clear. The visibility comes from this render rather than the ref, which a
           *  passive effect may not have caught up to yet. Releasing the lock is not the same event as leaving the unlock: the
           *  biometric prompt falls back to the PIN pad and steps back onto itself with the
           *  lock already down, so keying the retry on the lock would spend it too early. */
          const isRetryPending = isBlockerVisible && isResetDeferredRef.current
          if (isRetryPending) resetToBlocker("unlock-cleared")
        }}
      >
        {children}
      </NavigationContainer>
    </AuthenticationContextProvider>
  )
}
