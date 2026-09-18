import React, { useSyncExternalStore } from "react"
import { Text } from "react-native"
import { act, render } from "@testing-library/react-native"
import {
  createNavigationContainerRef,
  NavigationContainer,
} from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createTheme, ThemeProvider } from "@rn-vui/themed"

import { WalletCurrency } from "@app/graphql/generated"
import { InsufficientBalanceScreen } from "@app/screens/card-screen/onboarding/investment-flow"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { light, dark } from "@app/rne-theme/colors"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

/** Nothing signed yet, so the balance is measured against the chosen dollars. */
jest.mock("@app/hooks/use-card-investment-progress", () => ({
  useCardInvestmentProgress: () => ({ progress: null }),
}))

/**
 * A second spec for the same screen, on a real stack: the sibling spec mocks
 * `useNavigation` and `useIsFocused` module-wide, so it can say that `goBack` was
 * called but not which screen it removed, and that is the whole question here.
 */

/**
 * The funding, answered through a store every mounted screen subscribes to: the wallet
 * context works the same way, and a deposit landing updates the shortfall screen while
 * it sits underneath the receive screen, out of focus.
 */
const SHORT_FUNDING = {
  balanceUsd: 3333,
  balanceCurrency: WalletCurrency.Btc,
  shortfallUsd: 21667,
  hasEnoughBalance: false,
  isSplitAcrossWallets: false,
  isLoading: false,
}
const funding = { current: SHORT_FUNDING }
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const landDeposit = () => {
  funding.current = {
    ...funding.current,
    balanceUsd: 25000,
    shortfallUsd: 0,
    hasEnoughBalance: true,
  }
  listeners.forEach((listener) => listener())
}

jest.mock(
  "@app/screens/card-screen/onboarding/investment-flow/use-investment-funding",
  () => ({
    useInvestmentFunding: () => useSyncExternalStore(subscribe, () => funding.current),
  }),
)

type StackParamList = {
  transfer: undefined
  shortfall: { selectedAmountUsd: number }
  receive: undefined
}

const Stack = createNativeStackNavigator<StackParamList>()
const navigationRef = createNavigationContainerRef<StackParamList>()

const TransferStub = () => <Text>transfer step</Text>
const ReceiveStub = () => <Text>receive screen</Text>

const theme = createTheme({ lightColors: light, darkColors: dark, mode: "light" })

const renderStack = async () => {
  const utils = render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="transfer" component={TransferStub} />
            <Stack.Screen name="shortfall" component={InsufficientBalanceScreen} />
            <Stack.Screen name="receive" component={ReceiveStub} />
          </Stack.Navigator>
        </NavigationContainer>
      </TypesafeI18n>
    </ThemeProvider>,
  )
  await act(async () => {})
  return utils
}

const currentRoute = () => navigationRef.getCurrentRoute()?.name

describe("InsufficientBalanceScreen in a stack", () => {
  beforeEach(() => {
    loadLocale("en")
    funding.current = SHORT_FUNDING
  })

  /**
   * The deposit lands while the receive screen sits on top of the shortfall screen. A
   * `goBack` fired from underneath would pop the receive screen, the one the investor is
   * looking at; the shortfall screen must wait until it is back in front, then close
   * itself onto the transfer step.
   */
  it("leaves the receive screen in place when the deposit lands, and closes once back in front", async () => {
    await renderStack()
    await act(async () => {
      navigationRef.navigate("shortfall", { selectedAmountUsd: 25000 })
    })
    await act(async () => {
      navigationRef.navigate("receive")
    })
    expect(currentRoute()).toBe("receive")

    await act(async () => {
      landDeposit()
    })
    expect(currentRoute()).toBe("receive")

    await act(async () => {
      navigationRef.goBack()
    })
    await act(async () => {})

    expect(currentRoute()).toBe("transfer")
  })
})
