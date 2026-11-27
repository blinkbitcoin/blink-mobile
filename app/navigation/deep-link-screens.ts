import { getStateFromPath, LinkingOptions } from "@react-navigation/native"

import { CARD } from "@app/types/amounts"

import { RootStackParamList } from "./stack-param-lists"

/**
 * The deep-linkable routes. Kept in its own module so the set can be asserted
 * in tests: adding a route here makes it reachable from a crafted external URL,
 * so any route that trusts its own params must stay out. `webView` is the live
 * example — its `allowArbitraryUrl` param bypasses the origin allowlist and is
 * safe only because no deep link can reach the route (see stack-param-lists.ts).
 */
export const DEEP_LINK_SCREENS: NonNullable<
  NonNullable<LinkingOptions<RootStackParamList>["config"]>["screens"]
> = {
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
  /** The approval and activation links open the dashboard, which sends a member still
   *  in the activation on to the step they are at, or to the step they left. */
  cardDashboardScreen: {
    path: "card",
    alias: ["card/activate", "card/onboarding/approved"],
  },
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
  cardOnboardingPreapprovedScreen: "card/onboarding/preapproved",
  cardOnboardingDeclinedScreen: "card/onboarding/declined",
  transactionDetail: {
    path: "transaction/:txid",
  },
  sendBitcoinDestination: ":payment",
}

/** A route with the params its own entry in RootStackParamList takes. */
type FixedParamsRoute = {
  [Name in keyof RootStackParamList]-?: { name: Name; params: RootStackParamList[Name] }
}[keyof RootStackParamList]

/**
 * Paths that open a route with params the path itself does not carry, which the screens
 * above cannot express. A low-funds or decline bulletin's "Add funds", and the push behind
 * it, open the Transfer with the Card Balance fixed as its destination, as the card
 * dashboard's Add funds does (blink-wip#2271). A Map, so a path such as "constructor"
 * never reads an object's own keys.
 *
 * Every route here is also reachable through DEEP_LINK_SCREENS, so those screens stay
 * the one inventory of deep-linkable routes the security tests walk (asserted there).
 */
export const FIXED_PARAMS_ROUTES: ReadonlyMap<string, FixedParamsRoute> = new Map([
  ["card/add-funds", { name: "conversionDetails", params: { destination: CARD } }],
] satisfies [string, FixedParamsRoute][])

/** The path with no leading or trailing slash, query or fragment. */
const barePath = (path: string): string => path.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "")

/** The navigation state a deep link's path opens: a fixed-params path first, then the
 *  screens above. */
export const getDeepLinkState: NonNullable<
  LinkingOptions<RootStackParamList>["getStateFromPath"]
> = (path, options) => {
  const route = FIXED_PARAMS_ROUTES.get(barePath(path))
  if (route) return { routes: [route] }
  return getStateFromPath(path, options)
}
