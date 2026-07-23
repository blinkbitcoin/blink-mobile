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

/** The armed-gate reset is lock-aware: while the app is still locked it must land on
 *  authenticationCheck so the PIN/biometric unlock is never skipped. Jumping straight to
 *  Primary would strand isAppLocked at true, hiding the gate behind an app that never
 *  unlocked and freezing the queued migration deeplink (which waits on !isAppLocked). Once
 *  unlocked, Primary is correct: the blocker renders the gate with no jarring re-prompt. */
export const blockerEntryRoute = (
  isAppLocked: boolean,
): "authenticationCheck" | "Primary" => (isAppLocked ? "authenticationCheck" : "Primary")

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

  /** Kept current for resetToBlocker, which reads the lock state from a stable callback
   *  and from onReady, both of which would otherwise close over a stale value. */
  const isAppLockedRef = useRef(isAppLocked)
  useEffect(() => {
    isAppLockedRef.current = isAppLocked
  }, [isAppLocked])

  /** Pop anything a deeplink opened above the blocker so nothing keeps working over the
   *  closed account, landing on the lock-aware entry so arming never skips the unlock. */
  const resetToBlocker = useCallback(() => {
    navigationRef.reset({
      index: 0,
      routes: [{ name: blockerEntryRoute(isAppLockedRef.current) }],
    })
  }, [])

  /** Covers arming mid-session. The container-not-ready-yet case (armed at cold start) is
   *  handled from onReady below, since this effect can fire before isReady() is true. */
  useEffect(() => {
    if (isBlockerVisible && navigationRef.isReady()) resetToBlocker()
  }, [isBlockerVisible, resetToBlocker])

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
        cardOnboardingLoadingScreen: "card/onboarding/loading",
        cardOnboardingPersonalInfoScreen: "card/onboarding/personal-info",
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
          if (isBlockerVisibleRef.current) resetToBlocker()
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
