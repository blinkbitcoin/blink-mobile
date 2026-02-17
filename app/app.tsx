// Welcome to the main entry point of the app.
//
// In this file, we'll be kicking off the app
// language related import
import "intl-pluralrules"
import "node-libs-react-native/globals"
// needed for Buffer?
import * as React from "react"
import ErrorBoundary from "react-native-error-boundary"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import "react-native-reanimated"
import { RootSiblingParent } from "react-native-root-siblings"
// for URL; need a polyfill on react native
import "react-native-url-polyfill/auto"

import "@react-native-firebase/app"
import "@react-native-firebase/crashlytics"
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet"

import { GaloyThemeProvider } from "./components/galoy-theme-provider"
import { GaloyToast } from "./components/galoy-toast"
import { NotificationsProvider } from "./components/notifications/index"
import { PushNotificationComponent } from "./components/push-notification"
import { FeatureFlagContextProvider } from "./config/feature-flags-context"
import { GaloyClient } from "./graphql/client"
import { NetworkErrorComponent } from "./graphql/network-error-component"
import TypesafeI18n from "./i18n/i18n-react"
import { loadAllLocales } from "./i18n/i18n-util.sync"
import "./i18n/mapping"
import { AppStateWrapper } from "./navigation/app-state"
import { NavigationContainerWrapper } from "./navigation/navigation-container-wrapper"
import { RootStack } from "./navigation/root-navigator"
import { ErrorScreen } from "./screens/error-screen"
import { PersistentStateProvider } from "./store/persistent-state"
import { detectDefaultLocale } from "./utils/locale-detector"
import "./utils/logs"
import { ActionModals, ActionsProvider } from "./components/actions"

// FIXME should we only load the currently used local?
// this would help to make the app load faster
// this will become more important when we add more languages
// and when the earn section will be added
//
// alternatively, could try loadAllLocalesAsync()
loadAllLocales()

/**
 * This is the root component of our app.
 */
export const App = () => (
  /* eslint-disable-next-line react-native/no-inline-styles */
  <GestureHandlerRootView style={{ flex: 1 }}>
    <PersistentStateProvider>
      <TypesafeI18n locale={detectDefaultLocale()}>
        <GaloyClient>
          <GaloyThemeProvider>
            <FeatureFlagContextProvider>
              <ActionsProvider>
                <NavigationContainerWrapper>
                  <ErrorBoundary FallbackComponent={ErrorScreen}>
                    <RootSiblingParent>
                      <BottomSheetModalProvider>
                        <NotificationsProvider>
                          <AppStateWrapper />
                          <PushNotificationComponent />
                          <RootStack />
                          <NetworkErrorComponent />
                          <ActionModals />
                        </NotificationsProvider>
                        <GaloyToast />
                      </BottomSheetModalProvider>
                    </RootSiblingParent>
                  </ErrorBoundary>
                </NavigationContainerWrapper>
              </ActionsProvider>
            </FeatureFlagContextProvider>
          </GaloyThemeProvider>
        </GaloyClient>
      </TypesafeI18n>
    </PersistentStateProvider>
  </GestureHandlerRootView>
)
