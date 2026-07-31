import * as React from "react"
import { Linking, StyleSheet, View } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"

import { BLINK_DEEP_LINK_PREFIX } from "@app/config"
import { Icon, StatefulNotification } from "@app/graphql/generated"
import { light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"
import { Notification } from "@app/screens/notification-history-screen/notification"

import { findPressableParent } from "../helper"

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name }: { name: string }) => <View testID={`galoy-icon-${name}`} />,
}))

const makeNotification = (
  overrides: Partial<StatefulNotification> = {},
): StatefulNotification => ({
  __typename: "StatefulNotification",
  id: "notification-1",
  title: "Self-custodial accounts have arrived",
  body: "Move your funds to a wallet where only you hold the keys.",
  createdAt: Math.floor(Date.now() / 1000) - 30,
  acknowledgedAt: null,
  bulletinEnabled: false,
  icon: null,
  action: null,
  ...overrides,
})

const renderNotification = (notification: StatefulNotification) =>
  render(
    <ThemeProvider theme={theme}>
      <Notification {...notification} />
    </ThemeProvider>,
  )

describe("Notification", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
  })

  it("renders title, body and relative time", () => {
    const notification = makeNotification()
    const { getByText } = renderNotification(notification)

    expect(getByText(notification.title)).toBeTruthy()
    expect(getByText(notification.body)).toBeTruthy()
    expect(getByText("a few seconds ago")).toBeTruthy()
  })

  it("constrains the text column to the row width so long text wraps", () => {
    const { getByTestId } = renderNotification(makeNotification())

    const contentStyle = StyleSheet.flatten(
      getByTestId("notification-content").props.style,
    )
    expect(contentStyle).toMatchObject({ flex: 1 })
  })

  it("renders the mapped galoy icon when the notification has one", () => {
    const { getByTestId } = renderNotification(makeNotification({ icon: Icon.Bell }))

    expect(getByTestId("galoy-icon-bell")).toBeTruthy()
  })

  it("falls back to the default ionicon when the notification has no icon", () => {
    const { queryAllByTestId } = renderNotification(makeNotification())

    expect(queryAllByTestId(/^galoy-icon-/)).toHaveLength(0)
  })

  it("renders unacknowledged text in the primary color", () => {
    const notification = makeNotification()
    const { getByText } = renderNotification(notification)

    expect(getByText(notification.body)).toHaveStyle({ color: light.black })
  })

  it("renders acknowledged text greyed out", () => {
    const notification = makeNotification({ acknowledgedAt: 1700000000 })
    const { getByText } = renderNotification(notification)

    expect(getByText(notification.body)).toHaveStyle({ color: light.grey2 })
  })

  it("greys out the icon variant once acknowledged", () => {
    const notification = makeNotification({
      icon: Icon.Bell,
      acknowledgedAt: 1700000000,
    })
    const { getByText } = renderNotification(notification)

    expect(getByText(notification.body)).toHaveStyle({ color: light.grey2 })
  })

  it("greys out the text when acknowledgedAt arrives after mount", () => {
    const notification = makeNotification()
    const { getByText, rerender } = renderNotification(notification)

    expect(getByText(notification.body)).toHaveStyle({ color: light.black })

    rerender(
      <ThemeProvider theme={theme}>
        <Notification {...notification} acknowledgedAt={1700000000} />
      </ThemeProvider>,
    )

    expect(getByText(notification.body)).toHaveStyle({ color: light.grey2 })
  })

  it("opens the blink deep link when pressed with a deep link action", () => {
    const notification = makeNotification({
      action: {
        __typename: "OpenDeepLinkAction",
        deepLink: "/settings",
        label: "Open settings",
      },
    })
    const { getByText } = renderNotification(notification)

    fireEvent.press(findPressableParent(getByText(notification.title)))

    expect(Linking.openURL).toHaveBeenCalledWith(`${BLINK_DEEP_LINK_PREFIX}/settings`)
  })

  it("opens the external url when pressed with an external link action", () => {
    const notification = makeNotification({
      action: {
        __typename: "OpenExternalLinkAction",
        url: "https://www.blink.sv",
        label: "Learn more",
      },
    })
    const { getByText } = renderNotification(notification)

    fireEvent.press(findPressableParent(getByText(notification.title)))

    expect(Linking.openURL).toHaveBeenCalledWith("https://www.blink.sv")
  })

  it("does not open anything when pressed without an action", () => {
    const notification = makeNotification()
    const { getByText } = renderNotification(notification)

    fireEvent.press(findPressableParent(getByText(notification.title)))

    expect(Linking.openURL).not.toHaveBeenCalled()
  })
})
