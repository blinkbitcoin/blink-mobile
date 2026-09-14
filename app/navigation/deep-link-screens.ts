import { LinkingOptions } from "@react-navigation/native"

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
}
