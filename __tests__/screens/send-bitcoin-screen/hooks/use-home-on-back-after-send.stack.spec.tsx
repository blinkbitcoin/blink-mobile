import React from "react"
import { Pressable, Text } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import {
  createNavigationContainerRef,
  NavigationContainer,
  NavigationState,
  useNavigation,
} from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"

import {
  homeAfterSendAction,
  useHomeOnBackAfterSend,
} from "@app/screens/send-bitcoin-screen/hooks/use-home-on-back-after-send"

/**
 * A second spec for the hook, on the app's own nesting: the root stack, `Primary`'s tabs,
 * and People's own stack (root-navigator.tsx). The sibling spec hands the hook a stand-in
 * navigation, so it can say what the hook dispatched but not where a `goBack` from review
 * ends up. On a flat stack `popToTop` looked right, yet it kept `Primary`'s selected tab
 * and its stack, so a send started from a contact went back to that contact.
 */

type PeopleParamList = {
  peopleHome: undefined
  contactDetail: undefined
}

type RootParamList = {
  Primary: undefined
  sendBitcoinDetails: undefined
  sendBitcoinConfirmation: { hasAttemptedSend: boolean }
}

const Root = createNativeStackNavigator<RootParamList>()
const Tabs = createBottomTabNavigator()
const People = createNativeStackNavigator<PeopleParamList>()
const navigationRef = createNavigationContainerRef<RootParamList>()

const HomeStub = () => <Text>home</Text>
const PeopleHomeStub = () => <Text>people</Text>
const ContactDetailStub = () => <Text>contact detail</Text>
const AmountEntryStub = () => <Text>amount entry</Text>

const PeopleStack = () => (
  <People.Navigator initialRouteName="peopleHome">
    <People.Screen name="peopleHome" component={PeopleHomeStub} />
    <People.Screen name="contactDetail" component={ContactDetailStub} />
  </People.Navigator>
)

const PrimaryTabs = () => (
  <Tabs.Navigator initialRouteName="Home">
    <Tabs.Screen name="Home" component={HomeStub} />
    <Tabs.Screen name="People" component={PeopleStack} />
  </Tabs.Navigator>
)

const ReviewStub = ({ route }: { route: { params: { hasAttemptedSend: boolean } } }) => {
  const navigation = useNavigation()
  useHomeOnBackAfterSend(route.params.hasAttemptedSend)
  return (
    <>
      <Pressable testID="go-back" onPress={() => navigation.goBack()}>
        <Text>review</Text>
      </Pressable>
      {/* Sent's Close, as review dispatches it. */}
      <Pressable
        testID="sent-close"
        onPress={() => navigation.dispatch(homeAfterSendAction())}
      >
        <Text>close</Text>
      </Pressable>
    </>
  )
}

const renderSend = async ({
  fromContact,
  hasAttemptedSend,
  leaveBy = "go-back",
}: {
  fromContact: boolean
  hasAttemptedSend: boolean
  leaveBy?: "go-back" | "sent-close"
}) => {
  render(
    <NavigationContainer ref={navigationRef}>
      <Root.Navigator initialRouteName="Primary">
        <Root.Screen name="Primary" component={PrimaryTabs} />
        <Root.Screen name="sendBitcoinDetails" component={AmountEntryStub} />
        <Root.Screen name="sendBitcoinConfirmation" component={ReviewStub} />
      </Root.Navigator>
    </NavigationContainer>,
  )
  if (fromContact) {
    // The contact's Send button: People's stack, then up to the root's send screens.
    await act(async () => {
      navigationRef.dispatch({
        type: "NAVIGATE",
        payload: {
          name: "Primary",
          params: { screen: "People", params: { screen: "contactDetail" } },
        },
      })
    })
  }
  await act(async () => {
    navigationRef.navigate("sendBitcoinDetails")
  })
  await act(async () => {
    navigationRef.navigate("sendBitcoinConfirmation", { hasAttemptedSend })
  })
  await act(async () => {
    fireEvent.press(screen.getByTestId(leaveBy))
  })
}

/** The root routes, the selected tab, and the screen on top of that tab's own stack. */
const where = () => {
  const root = navigationRef.getRootState()
  const primary = root.routes[0].state as NavigationState | undefined
  const tab = primary?.routes[primary.index]
  const tabStack = tab?.state as NavigationState | undefined
  return {
    root: root.routes.map((route) => route.name),
    tab: tab?.name,
    tabTop: tabStack?.routes[tabStack.index].name,
  }
}

describe("useHomeOnBackAfterSend on the app's navigators", () => {
  it("lets goBack return to amount entry before any send", async () => {
    await renderSend({ fromContact: false, hasAttemptedSend: false })

    expect(where().root).toEqual(["Primary", "sendBitcoinDetails"])
  })

  /** Any goBack from review, a header arrow or a "Change amount" alike, lands Home once a
   *  send was attempted: review must not offer a way back to amount entry after one. */
  it("turns goBack into Home after a send attempt", async () => {
    await renderSend({ fromContact: false, hasAttemptedSend: true })

    expect(where()).toEqual({ root: ["Primary"], tab: "Home", tabTop: undefined })
  })

  it("lands on Home, not the contact, for a send started from People", async () => {
    await renderSend({ fromContact: true, hasAttemptedSend: true })

    expect(where()).toEqual({ root: ["Primary"], tab: "Home", tabTop: undefined })
  })

  it("still returns to amount entry before any send started from People", async () => {
    await renderSend({ fromContact: true, hasAttemptedSend: false })

    expect(where().root).toEqual(["Primary", "sendBitcoinDetails"])
  })
})

/** Close on Sent leaves by the same action. Once Sent has settled, review hands back to
 *  Sent's own hold and the hook is off, so the action has to reach Home on its own. */
describe("Sent's Close on the app's navigators", () => {
  it("lands on Home for a send started from Home", async () => {
    await renderSend({
      fromContact: false,
      hasAttemptedSend: false,
      leaveBy: "sent-close",
    })

    expect(where()).toEqual({ root: ["Primary"], tab: "Home", tabTop: undefined })
  })

  it("lands on Home, not the contact, for a send started from People", async () => {
    await renderSend({
      fromContact: true,
      hasAttemptedSend: false,
      leaveBy: "sent-close",
    })

    expect(where()).toEqual({ root: ["Primary"], tab: "Home", tabTop: undefined })
  })
})
