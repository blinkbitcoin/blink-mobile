import React from "react"
import { Text } from "react-native"
import { act, render } from "@testing-library/react-native"
import {
  createNavigationContainerRef,
  NavigationContainer,
} from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { usePaidDismiss } from "@app/screens/receive-bitcoin-screen/hooks/use-paid-dismiss"
import {
  PaymentRequestState,
  PaymentRequestStateType,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"

/**
 * A second spec for the hook, on a real stack. The sibling spec hands the hook a stand-in
 * navigation, so it can say what the hook dispatched but not what the stack holds after:
 * `navigate("Primary")` read right there, yet pushed a second Home over the paid receive,
 * and Back brought that receive back.
 */

type RootParamList = {
  Primary: undefined
  receiveBitcoin: { state: PaymentRequestStateType }
}

const Root = createNativeStackNavigator<RootParamList>()
const navigationRef = createNavigationContainerRef<RootParamList>()

const HomeStub = () => <Text>home</Text>

const ReceiveStub = ({
  route,
}: {
  route: { params: { state: PaymentRequestStateType } }
}) => {
  usePaidDismiss(route.params.state)
  return <Text>receive</Text>
}

const setState = async (state: PaymentRequestStateType) => {
  await act(async () => {
    navigationRef.setParams({ state })
  })
}

const routes = () => navigationRef.getRootState().routes.map((route) => route.name)

describe("usePaidDismiss on a real stack", () => {
  beforeEach(async () => {
    render(
      <NavigationContainer ref={navigationRef}>
        <Root.Navigator initialRouteName="Primary">
          <Root.Screen name="Primary" component={HomeStub} />
          <Root.Screen name="receiveBitcoin" component={ReceiveStub} />
        </Root.Navigator>
      </NavigationContainer>,
    )
    await act(async () => {
      navigationRef.navigate("receiveBitcoin", { state: PaymentRequestState.Created })
    })
  })

  it("returns to the existing Home once a Dollar receive settles", async () => {
    await setState(PaymentRequestState.Converting)
    await setState(PaymentRequestState.Paid)

    expect(routes()).toEqual(["Primary"])
    expect(navigationRef.canGoBack()).toBe(false)
  })
})
