import React, { PropsWithChildren } from "react"
import type { ReactTestInstance } from "react-test-renderer"

import { MockedProvider } from "@apollo/client/testing"
import mocks from "@app/graphql/mocks"
import TypesafeI18n from "@app/i18n/i18n-react"
import theme from "@app/rne-theme/theme"
import { light, dark } from "@app/rne-theme/colors"
import { detectDefaultLocale } from "@app/utils/locale-detector"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createTheme, ThemeProvider } from "@rn-vui/themed"

import type { SelfCustodialAccountEntry } from "@app/self-custodial/storage/account-index"

import { createCache } from "../../app/graphql/cache"
import { IsAuthedContextProvider } from "../../app/graphql/is-authed-context"
import {
  AccountRegistryContext,
  useComposedAccountRegistry,
} from "../../app/hooks/use-account-registry"
import { PersistentStateContext } from "../../app/store/persistent-state"

const PersistentStateWrapper: React.FC<PropsWithChildren> = ({ children }) => (
  <PersistentStateContext.Provider
    value={{
      persistentState: {
        schemaVersion: 16,
        galoyInstance: {
          id: "Main",
        },
        galoyAuthToken: "",
      },
      updateState: () => {},
      resetState: () => {},
      clearToken: async () => {},
    }}
  >
    <>{children}</>
  </PersistentStateContext.Provider>
)

export type AccountRegistrySeed = {
  entries?: SelfCustodialAccountEntry[]
  hasStoredCustodialProfile?: boolean
}

/**
 * A *settled* account registry — it never performs the provider's two device
 * reads, so mocking `listSelfCustodialAccounts` or
 * `KeyStoreWrapper.getSessionProfiles` does not reach it. Those reads resolve
 * after a synchronous test body returns, which trips React's "not wrapped in
 * act(...)" warning in every suite that mounts a screen.
 *
 * To render a screen against self-custodial accounts, seed them through the
 * `accountRegistry` prop on the wrappers below. To exercise hydration itself,
 * mount `AccountRegistryProvider` directly and `await flushEffects()`.
 *
 * `hasStoredCustodialProfile` defaults to `true` to match the provider under
 * these wrappers, which mount `IsAuthedContextProvider value={true}`.
 */
// Stable identities: the composed value is memoised on these, so fresh
// literals per render would hand every consumer a new registry each time.
const NO_ENTRIES: SelfCustodialAccountEntry[] = []
const noopReload = async () => {}

const StubAccountRegistry: React.FC<PropsWithChildren<AccountRegistrySeed>> = ({
  children,
  entries = NO_ENTRIES,
  hasStoredCustodialProfile = true,
}) => (
  <AccountRegistryContext.Provider
    value={useComposedAccountRegistry({
      selfCustodialEntries: entries,
      hasStoredCustodialProfile,
      loading: false,
      reloadSelfCustodialAccounts: noopReload,
    })}
  >
    {children}
  </AccountRegistryContext.Provider>
)

export const findPressableParent = (
  node: ReactTestInstance | null,
): ReactTestInstance => {
  let current: ReactTestInstance | null = node
  while (current && !current.props?.onPress) {
    current = current.parent
  }
  if (!current) {
    throw new Error("Pressable parent not found")
  }
  return current
}

const Stack = createNativeStackNavigator()

type ThemeMode = "light" | "dark"

const createThemeWithMode = (mode: ThemeMode) =>
  createTheme({
    lightColors: light,
    darkColors: dark,
    mode,
  })

export const ContextForScreen: React.FC<
  PropsWithChildren<{ headerShown?: boolean; accountRegistry?: AccountRegistrySeed }>
> = ({ children, headerShown = false, accountRegistry }) => (
  <ThemeProvider theme={theme}>
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown }}>
        <Stack.Screen name="Home">
          {() => (
            <MockedProvider mocks={mocks} cache={createCache()}>
              <PersistentStateWrapper>
                <TypesafeI18n locale={detectDefaultLocale()}>
                  <IsAuthedContextProvider value={true}>
                    <StubAccountRegistry {...accountRegistry}>
                      {children}
                    </StubAccountRegistry>
                  </IsAuthedContextProvider>
                </TypesafeI18n>
              </PersistentStateWrapper>
            </MockedProvider>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  </ThemeProvider>
)

export const ContextForScreenWithTheme: React.FC<
  PropsWithChildren<{ mode: ThemeMode; accountRegistry?: AccountRegistrySeed }>
> = ({ children, mode, accountRegistry }) => (
  <ThemeProvider theme={createThemeWithMode(mode)}>
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home">
          {() => (
            <MockedProvider mocks={mocks} cache={createCache()}>
              <PersistentStateWrapper>
                <TypesafeI18n locale={detectDefaultLocale()}>
                  <IsAuthedContextProvider value={true}>
                    <StubAccountRegistry {...accountRegistry}>
                      {children}
                    </StubAccountRegistry>
                  </IsAuthedContextProvider>
                </TypesafeI18n>
              </PersistentStateWrapper>
            </MockedProvider>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  </ThemeProvider>
)
