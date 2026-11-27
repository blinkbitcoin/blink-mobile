import React from "react"
import { Text } from "react-native"
import { act, render, screen } from "@testing-library/react-native"
import { LinkingOptions, NavigationContainer } from "@react-navigation/native"
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from "@react-navigation/native-stack"

import { PREFIX_LINKING } from "@app/config"
import { DEEP_LINK_SCREENS, getDeepLinkState } from "@app/navigation/deep-link-screens"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

/**
 * The app's links through React Navigation itself: its prefixes take the path out of the
 * URL, and the app's deep-link state turns it into the route a link opens.
 * blink-wip#2271: a bulletin opens `blink://card/add-funds`, a push `blink:/card/add-funds`.
 */

const Stack = createNativeStackNavigator<RootStackParamList>()

type ProbeProps = NativeStackScreenProps<RootStackParamList, keyof RootStackParamList>

const RouteProbe = ({ route }: ProbeProps) => (
  <Text>{`${route.name} ${JSON.stringify(route.params ?? {})}`}</Text>
)

const renderApp = (initialUrl: string | null) => {
  let deliver: (url: string) => void = () => {}
  const linking: LinkingOptions<RootStackParamList> = {
    prefixes: PREFIX_LINKING,
    config: { screens: DEEP_LINK_SCREENS },
    getStateFromPath: getDeepLinkState,
    getInitialURL: () => initialUrl,
    subscribe: (listener) => {
      deliver = listener
      return () => {}
    },
  }
  render(
    <NavigationContainer linking={linking}>
      <Stack.Navigator initialRouteName="Primary">
        <Stack.Screen name="Primary" component={RouteProbe} />
        <Stack.Screen name="conversionDetails" component={RouteProbe} />
        <Stack.Screen name="cardSettingsScreen" component={RouteProbe} />
      </Stack.Navigator>
    </NavigationContainer>,
  )
  return { receive: (url: string) => act(() => deliver(url)) }
}

const TRANSFER_INTO_CARD = 'conversionDetails {"destination":"CARD"}'

describe("deep links through React Navigation", () => {
  it("opens the Transfer into the Card Balance from a bulletin's link on a cold start", async () => {
    renderApp("blink://card/add-funds")

    expect(await screen.findByText(TRANSFER_INTO_CARD)).toBeTruthy()
  })

  it("opens the Transfer into the Card Balance from a push's link while the app is open", async () => {
    const { receive } = renderApp(null)
    await screen.findByText("Primary {}")

    receive("blink:/card/add-funds")

    expect(await screen.findByText(TRANSFER_INTO_CARD)).toBeTruthy()
  })

  it("still opens the other card links through the screens", async () => {
    renderApp("blink://card/settings")

    expect(await screen.findByText("cardSettingsScreen {}")).toBeTruthy()
  })
})
