// Welcome to the main entry point of the app.
//
// In this file, we'll be kicking off the app.
// language related import
import "intl-pluralrules"
import "node-libs-react-native/globals"
// needed for Buffer?
import * as React from "react"
import ErrorBoundary from "react-native-error-boundary"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import "react-native-reanimated"
import { RootSiblingParent } from "react-native-root-siblings"
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context"
// for URL; need a polyfill on react native
import "react-native-url-polyfill/auto"

import "@react-native-firebase/app"
import "@react-native-firebase/crashlytics"

import { GaloyThemeProvider } from "./components/galoy-theme-provider"
import { GaloyToast } from "./components/galoy-toast"
import { NotificationsProvider } from "./components/notifications/index"
import { PushNotificationComponent } from "./components/push-notification"
import { FeatureFlagContextProvider } from "./config/feature-flags-context"
import { CustodialWalletProvider } from "./custodial/providers/wallet"
import { initializeTelemetryGate } from "./telemetry"
import {
  AccountModeSyncMount,
  AutoConvertListenerMount,
  DisplayCurrencyFromRegionMount,
} from "./self-custodial/components"
import { AutoConvertStatusProvider } from "./self-custodial/providers/auto-convert-status"
import { BackupStateProvider } from "./self-custodial/providers/backup-state"
import { SelfCustodialTelemetryMount } from "./self-custodial/providers/telemetry"
import { SelfCustodialWalletProvider } from "./self-custodial/providers/wallet"
import { GaloyClient } from "./graphql/client"
import { NetworkErrorComponent } from "./graphql/network-error-component"
import TypesafeI18n from "./i18n/i18n-react"
import { loadLocale } from "./i18n/i18n-util.sync"
import "./i18n/mapping"
import { AppStateWrapper } from "./navigation/app-state"
import { NavigationContainerWrapper } from "./navigation/navigation-container-wrapper"
import { RootStack } from "./navigation/root-navigator"
import { MigrationBlockerProvider } from "./screens/account-migration/hooks/use-migration-blocker"
import { ErrorScreen } from "./screens/error-screen"
import { PersistentStateProvider } from "./store/persistent-state"
import { detectDefaultLocale } from "./utils/locale-detector"
import "./utils/logs"
import { ActionModals, ActionsProvider } from "./components/actions"
import { EnhancedModePromptProvider } from "./components/enhanced-mode-prompt"
import { RestrictedRegionProvider } from "./components/restricted-region"

// Lazy load only the default locale instead of all 27 locales
// This reduces startup time by 3-5 seconds on Android
// Other locales are loaded on-demand when user switches language
const defaultLocale = detectDefaultLocale()
loadLocale(defaultLocale)
if (__DEV__) console.log(`Loaded default locale: ${defaultLocale}`)

// Shut the analytics gate as early as any JavaScript can. Firebase persists the last value
// of `setAnalyticsCollectionEnabled` across launches and that persisted value overrides
// `firebase.json`, so a device that resolved Custodial last run starts this one collecting
// — including automatic and screen-level events (FR-3).
//
// This narrows that window; it does not close it. Native automatic events (`session_start`,
// `app_open`) fire when Firebase initialises, before the RN bridge runs a line of JS, so a
// device whose mode has since changed to Anon can emit them once per cold start. Closing it
// needs the disable to move native-side — persisting the last resolved mode somewhere
// `AppDelegate` / `MainApplication` can read before Firebase starts. Until then it is a
// stated residual for the metric contracts (FR-56), alongside the arrival-timing one.
initializeTelemetryGate()

/**
 * This is the root component of our app.
 */
export const App = () => (
  /* eslint-disable-next-line react-native/no-inline-styles */
  <GestureHandlerRootView style={{ flex: 1 }}>
    {/* Every screen reads its window insets from here. React Navigation supplies a
        provider of its own inside each navigator, but only there and only after the
        first frame, so anything rendered outside or before it measured zero insets
        and drew under the system bars. */}
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PersistentStateProvider>
        <TypesafeI18n locale={detectDefaultLocale()}>
          <GaloyClient>
            <GaloyThemeProvider>
              <FeatureFlagContextProvider>
                <CustodialWalletProvider>
                  <SelfCustodialWalletProvider>
                    <BackupStateProvider>
                      <AutoConvertStatusProvider>
                        <ActionsProvider>
                          <MigrationBlockerProvider>
                            <NavigationContainerWrapper>
                              <ErrorBoundary FallbackComponent={ErrorScreen}>
                                <RootSiblingParent>
                                  <EnhancedModePromptProvider>
                                    <RestrictedRegionProvider>
                                      <NotificationsProvider>
                                        <AppStateWrapper />
                                        <PushNotificationComponent />
                                        <AutoConvertListenerMount />
                                        <AccountModeSyncMount />
                                        <SelfCustodialTelemetryMount />
                                        <DisplayCurrencyFromRegionMount />
                                        <RootStack />
                                        <NetworkErrorComponent />
                                        <ActionModals />
                                      </NotificationsProvider>
                                    </RestrictedRegionProvider>
                                  </EnhancedModePromptProvider>
                                  <GaloyToast />
                                </RootSiblingParent>
                              </ErrorBoundary>
                            </NavigationContainerWrapper>
                          </MigrationBlockerProvider>
                        </ActionsProvider>
                      </AutoConvertStatusProvider>
                    </BackupStateProvider>
                  </SelfCustodialWalletProvider>
                </CustodialWalletProvider>
              </FeatureFlagContextProvider>
            </GaloyThemeProvider>
          </GaloyClient>
        </TypesafeI18n>
      </PersistentStateProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
)
