import * as React from "react"
import { Linking, StyleSheet } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"

import { BLINK_DEEP_LINK_PREFIX } from "@app/config"
import { Icon, StatefulNotification } from "@app/graphql/generated"
import { light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"
import { Notification } from "@app/screens/notification-history-screen/notification"

import { findPressableParent } from "../helper"

import { UNMAPPED_ICON } from "./helpers"

/**
 * `timeAgo` reads the wall clock, so the relative-time assertion only stays
 * stable if both the clock and the notification timestamp are pinned.
 */
const FIXED_NOW_MS = Date.UTC(2026, 0, 15, 12, 0, 0)
const THIRTY_SECONDS_AGO = Math.floor(FIXED_NOW_MS / 1000) - 30
const ACKNOWLEDGED_AT = Math.floor(FIXED_NOW_MS / 1000) - 60

const makeNotification = (
  overrides: Partial<StatefulNotification> = {},
): StatefulNotification => ({
  __typename: "StatefulNotification",
  id: "notification-1",
  title: "Self-custodial accounts have arrived",
  body: "Move your funds to a wallet where only you hold the keys.",
  createdAt: THIRTY_SECONDS_AGO,
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
    jest.useFakeTimers({ now: FIXED_NOW_MS })
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
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

    expect(getByTestId("icon-bell")).toBeTruthy()
  })

  it("maps every underscore of the icon enum to an icon that has an asset", () => {
    const { getByTestId } = renderNotification(
      makeNotification({ icon: Icon.WarningWithBackground }),
    )

    expect(getByTestId("icon-warning-with-background")).toBeTruthy()
  })

  it("falls back to the default ionicon when the notification has no icon", () => {
    const { getByTestId } = renderNotification(makeNotification())

    expect(getByTestId("notification-default-icon")).toBeTruthy()
  })

  it("falls back to the default ionicon when the icon has no asset", () => {
    const { getByTestId, queryByTestId } = renderNotification(
      makeNotification({ icon: UNMAPPED_ICON }),
    )

    expect(getByTestId("notification-default-icon")).toBeTruthy()
    expect(queryByTestId(`icon-${UNMAPPED_ICON.toLowerCase()}`)).toBeNull()
  })

  it("renders unacknowledged text and icon in the primary color", () => {
    const notification = makeNotification({ icon: Icon.Bell })
    const { getByText, getByTestId } = renderNotification(notification)

    expect(getByText(notification.body)).toHaveStyle({ color: light.black })
    expect(getByTestId("icon-bell").props.color).toBe(light.black)
  })

  it("renders acknowledged text greyed out", () => {
    const notification = makeNotification({ acknowledgedAt: ACKNOWLEDGED_AT })
    const { getByText } = renderNotification(notification)

    expect(getByText(notification.body)).toHaveStyle({ color: light.grey2 })
  })

  it("greys out the icon variant once acknowledged", () => {
    const notification = makeNotification({
      icon: Icon.Bell,
      acknowledgedAt: ACKNOWLEDGED_AT,
    })
    const { getByTestId } = renderNotification(notification)

    expect(getByTestId("icon-bell").props.color).toBe(light.grey2)
  })

  it("greys out the text when acknowledgedAt arrives after mount", () => {
    const notification = makeNotification()
    const { getByText, rerender } = renderNotification(notification)

    expect(getByText(notification.body)).toHaveStyle({ color: light.black })

    rerender(
      <ThemeProvider theme={theme}>
        <Notification {...notification} acknowledgedAt={ACKNOWLEDGED_AT} />
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
