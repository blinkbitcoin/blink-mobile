import React from "react"
import { Pressable, Text } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import {
  createNavigationContainerRef,
  NavigationContainer,
  useNavigation,
} from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { useHomeOnBackAfterSend } from "@app/screens/send-bitcoin-screen/hooks/use-home-on-back-after-send"

/**
 * A second spec for the hook, on a real stack: the sibling spec hands it a stand-in
 * navigation, so it can say the hook dispatched popToTop but not where a `goBack` from
 * the screen ends up, and that is what decides whether review may offer one.
 */

type StackParamList = {
  home: undefined
  amountEntry: undefined
  review: { hasAttemptedSend: boolean }
}

const Stack = createNativeStackNavigator<StackParamList>()
const navigationRef = createNavigationContainerRef<StackParamList>()

const Stub = ({ label }: { label: string }) => <Text>{label}</Text>
const HomeStub = () => <Stub label="home" />
const AmountEntryStub = () => <Stub label="amount entry" />

const ReviewStub = ({ route }: { route: { params: { hasAttemptedSend: boolean } } }) => {
  const navigation = useNavigation()
  useHomeOnBackAfterSend(route.params.hasAttemptedSend)
  return (
    <Pressable testID="go-back" onPress={() => navigation.goBack()}>
      <Text>review</Text>
    </Pressable>
  )
}

const renderStack = async (hasAttemptedSend: boolean) => {
  render(
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="home">
        <Stack.Screen name="home" component={HomeStub} />
        <Stack.Screen name="amountEntry" component={AmountEntryStub} />
        <Stack.Screen name="review" component={ReviewStub} />
      </Stack.Navigator>
    </NavigationContainer>,
  )
  await act(async () => {
    navigationRef.navigate("amountEntry")
  })
  await act(async () => {
    navigationRef.navigate("review", { hasAttemptedSend })
  })
}

const routeNames = () => navigationRef.getRootState().routes.map((route) => route.name)

describe("useHomeOnBackAfterSend on a real stack", () => {
  it("lets goBack return to amount entry before any send", async () => {
    await renderStack(false)

    await act(async () => {
      fireEvent.press(screen.getByTestId("go-back"))
    })

    expect(routeNames()).toEqual(["home", "amountEntry"])
  })

  /** Any goBack from review, a header arrow or a "Change amount" alike, lands Home once a
   *  send was attempted: review must not offer a way back to amount entry after one. */
  it("turns goBack into Home after a send attempt", async () => {
    await renderStack(true)

    await act(async () => {
      fireEvent.press(screen.getByTestId("go-back"))
    })

    expect(routeNames()).toEqual(["home"])
  })
})
