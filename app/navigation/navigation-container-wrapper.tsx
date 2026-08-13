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

/** What the migration deeplink above opens. The armed gate lets that one link through, so
 *  it is the one thing that can legitimately appear above the blocker after the gate armed,
 *  and a retry finishing an older job must not pop the screen it just opened. */
const MIGRATION_ENTRY_ROUTE = "accountMigrationEntry" satisfies keyof RootStackParamList

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
  mustRouteThroughUnlock: boolean,
): boolean => {
  const routes = state?.routes ?? []
  const blockerIndex = routes.findIndex((route) => route.name === BLOCKER_ROUTE)
  if (blockerIndex === -1) return false

  const hasRoutesAboveBlocker = blockerIndex < routes.length - 1
  return hasRoutesAboveBlocker || mustRouteThroughUnlock
}

/** Why the stack is being judged. The two triggers do not carry the same authority: arming
 *  owns both of the jobs above, while a retry exists only to finish the pop an unlock stood
 *  in front of, and must not bounce a session elsewhere on the strength of a lock its own
 *  flow never lowered (the three-strikes logout resets the stack without unlocking). */
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
   *  closed account, landing on the lock-aware entry so arming never skips the unlock.
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

    /** Only a retry has to make this allowance. Arming pops everything above the blocker,
     *  as it always has: those screens were opened before the gate existed. */
    const isOnSanctionedEntry = routeInFront.name === MIGRATION_ENTRY_ROUTE
    if (!isArming && isOnSanctionedEntry) {
      isResetDeferredRef.current = false
      return
    }

    const mustRouteThroughUnlock = isAppLockedRef.current && isArming

    /** Judged before the unlock is: a reset that would achieve nothing has nothing to come
     *  back for either, so it must not leave a retry armed behind it. */
    if (!isResetWarranted(rootState, mustRouteThroughUnlock)) {
      isResetDeferredRef.current = false
      return
    }

    isResetDeferredRef.current = isUnlockInProgress(routeInFront)
    if (isResetDeferredRef.current) return

    navigationRef.reset({
      index: 0,
      routes: [{ name: blockerEntryRoute(mustRouteThroughUnlock) }],
    })
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
      screens: {
        Primary: {
          screens: {
            Home: "home",
            People: {
              path: "people",
              initialRouteName: "peopleHome",
              screens: {
                circlesDashboard: "circles",
              },
            },
            Earn: "earn",
            Map: "map",
          },
        },
        priceHistory: "price",
        receiveBitcoin: "receive",
        conversionDetails: "convert",
        scanningQRCode: "scan-qr",
        totpRegistrationInitiate: "settings/2fa",
        currency: "settings/display-currency",
        defaultWallet: "settings/default-account",
        language: "settings/language",
        theme: "settings/theme",
        security: "settings/security",
        accountScreen: "settings/account",
        transactionLimitsScreen: "settings/tx-limits",
        feeRatesScreen: "settings/fee-rates",
        notificationSettingsScreen: "settings/notifications",
        emailRegistrationInitiate: "settings/email",
        settings: "settings",
        cardDashboardScreen: "card",
        cardDetailsScreen: "card/details",
        cardLimitsScreen: "card/limits",
        cardSettingsScreen: "card/settings",
        cardStatementsScreen: "card/statements",
        cardTransactionDetailsScreen: {
          path: "card/transaction/:transactionId",
        },
        accountMigrationEntry: "account-migration",
        cardOnboardingWelcomeScreen: "card/onboarding",
        cardOnboardingSubscribeScreen: "card/onboarding/subscribe",
        cardOnboardingLoadingScreen: "card/onboarding/loading",
        cardOnboardingPersonalInfoScreen: "card/onboarding/personal-info",
        cardOnboardingAcknowledgementScreen: "card/onboarding/acknowledgement",
        cardOnboardingProcessingScreen: "card/onboarding/processing",
        cardOnboardingPreapprovedScreen: "card/onboarding/preapproved",
        cardOnboardingApprovedScreen: "card/onboarding/approved",
        transactionDetail: {
          path: "transaction/:txid",
        },
        sendBitcoinDestination: ":payment",
      },
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
