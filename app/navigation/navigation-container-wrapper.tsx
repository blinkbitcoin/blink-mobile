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

/** The root route the blocker renders under: PrimaryNavigator swaps its tabs for the gate. */
const BLOCKER_ROUTE = "Primary" as const

/** The unlock flow's own screens. Resetting the stack while one of them is in front tears
 *  down an unlock the user is halfway through and serves them an identical empty one, which
 *  is the PIN screen that kept reappearing on every launch (#4150). */
const UNLOCK_ROUTES = new Set<string>([
  "authenticationCheck",
  "authentication",
  "pin",
] satisfies (keyof RootStackParamList)[])

type RootRoutes = NavigationState["routes"]

/** Whether the root stack holds anything for the blocker to pop. The blocker renders inside
 *  its own route, so a stack that is already just that route needs nothing, and resetting it
 *  anyway would remount the gate for no reason. A stack with no routes to read is judged the
 *  same way an unreadable one is: nothing proven, nothing thrown away. */
const hasRoutesAboveBlocker = (routes: RootRoutes): boolean => {
  if (routes.length === 0) return false
  const hasStackedRoutes = routes.length > 1
  const isBlockerAtRoot = routes[0].name === BLOCKER_ROUTE
  return hasStackedRoutes || !isBlockerAtRoot
}

/** Whether an unlock stands in front of the pop, which only the topmost route can. */
const isUnlockInProgress = (routes: RootRoutes): boolean => {
  const topRoute = routes[routes.length - 1]
  return topRoute !== undefined && UNLOCK_ROUTES.has(topRoute.name)
}

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

  /** Set when a pop found an unlock in front of it, so the pop runs the moment that unlock
   *  finishes instead of being lost. Only that case waits: keying the pop on the lock state
   *  itself would re-run it on every resume unlock, throwing away whatever the gate had
   *  opened, and would never run at all in a session that signed in without ever unlocking. */
  const isPopDeferredRef = useRef(false)

  /** Pop anything a deeplink opened above the blocker so nothing keeps working over the
   *  closed account. */
  const popRoutesAboveBlocker = useCallback(() => {
    if (!navigationRef.isReady()) return

    const routes = navigationRef.getRootState()?.routes ?? []
    const isUnlockInTheWay = isUnlockInProgress(routes)
    isPopDeferredRef.current = isUnlockInTheWay

    if (isUnlockInTheWay) return
    if (!hasRoutesAboveBlocker(routes)) return
    navigationRef.reset({ index: 0, routes: [{ name: BLOCKER_ROUTE }] })
  }, [])

  /** Covers arming mid-session. The container-not-ready-yet case (armed at cold start) is
   *  handled from onReady below, since this effect can fire before isReady() is true. */
  useEffect(() => {
    if (!isBlockerVisible) return
    popRoutesAboveBlocker()
  }, [isBlockerVisible, popRoutesAboveBlocker])

  /** The waiting half: the unlock that stood in front of a pop has finished. */
  const hasUnlockFinished = isBlockerVisible && !isAppLocked

  useEffect(() => {
    if (!hasUnlockFinished) return
    if (!isPopDeferredRef.current) return
    popRoutesAboveBlocker()
  }, [hasUnlockFinished, popRoutesAboveBlocker])

  useEffect(() => {
    if (canHandlePayments && !isAppLocked && urlAfterUnlockAndAuth) {
      Linking.openURL(urlAfterUnlockAndAuth)
      setUrlAfterUnlockAndAuth(null)
    }
  }, [canHandlePayments, isAppLocked, urlAfterUnlockAndAuth])

  const setAppUnlocked = React.useMemo(
    () => async () => {
      setIsAppLocked(false)
    },
    [],
  )

  const setAppLocked = React.useMemo(() => () => setIsAppLocked(true), [])

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
          /** Cold-started already gated: pop now that the container is ready, since the
           *  effect above may have run before isReady() turned true. */
          if (isBlockerVisibleRef.current) popRoutesAboveBlocker()
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
        }}
      >
        {children}
      </NavigationContainer>
    </AuthenticationContextProvider>
  )
}
