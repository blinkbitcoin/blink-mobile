import React, { PropsWithChildren } from "react"

import { MockedProvider } from "@apollo/client/testing"
import mocks from "@app/graphql/mocks"
import TypesafeI18n from "@app/i18n/i18n-react"
import theme from "@app/rne-theme/theme"
import { light, dark } from "@app/rne-theme/colors"
import { detectDefaultLocale } from "@app/utils/locale-detector"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createTheme, ThemeProvider } from "@rn-vui/themed"

import { StoryScreen } from "../../.storybook/views"
import { createCache } from "../../app/graphql/cache"
import { IsAuthedContextProvider } from "../../app/graphql/is-authed-context"
import { AccountRegistryProvider } from "../../app/hooks/use-account-registry"

const Stack = createNativeStackNavigator()

type ThemeMode = "light" | "dark"

const createThemeWithMode = (mode: ThemeMode) =>
  createTheme({
    lightColors: light,
    darkColors: dark,
    mode,
  })

export const ContextForScreen: React.FC<PropsWithChildren<{ headerShown?: boolean }>> = ({
  children,
  headerShown = false,
}) => (
  <ThemeProvider theme={theme}>
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown }}>
        <Stack.Screen name="Home">
          {() => (
            <MockedProvider mocks={mocks} cache={createCache()}>
              <StoryScreen>
                <TypesafeI18n locale={detectDefaultLocale()}>
                  <IsAuthedContextProvider value={true}>
                    <AccountRegistryProvider>{children}</AccountRegistryProvider>
                  </IsAuthedContextProvider>
                </TypesafeI18n>
              </StoryScreen>
            </MockedProvider>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  </ThemeProvider>
)

export const ContextForScreenWithTheme: React.FC<
  PropsWithChildren<{ mode: ThemeMode }>
> = ({ children, mode }) => (
  <ThemeProvider theme={createThemeWithMode(mode)}>
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home">
          {() => (
            <MockedProvider mocks={mocks} cache={createCache()}>
              <StoryScreen>
                <TypesafeI18n locale={detectDefaultLocale()}>
                  <IsAuthedContextProvider value={true}>
                    <AccountRegistryProvider>{children}</AccountRegistryProvider>
                  </IsAuthedContextProvider>
                </TypesafeI18n>
              </StoryScreen>
            </MockedProvider>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  </ThemeProvider>
)
