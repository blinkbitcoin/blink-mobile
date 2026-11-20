import React from "react"
import { it } from "@jest/globals"
import { AccessibilityInfo, StyleSheet, Text } from "react-native"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"
import { getAnimatedStyle } from "react-native-reanimated"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { SUCCESS_BADGE_DURATION_MS, SuccessBadge } from "@app/components/success-badge"
import {
  SUCCESS_HOLD_MS,
  SUCCESS_SCREEN_EXIT_MS,
  SUCCESS_SCREEN_TEST_ID,
  SuccessScreen,
} from "@app/components/success-screen"

import { ContextForScreen } from "../screens/helper"

jest.mock("react-native-haptic-feedback", () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
}))

const TITLE = "Your backup phrase is correct"

const renderScreen = (props: Partial<React.ComponentProps<typeof SuccessScreen>> = {}) =>
  render(
    <ContextForScreen>
      <SuccessScreen title={TITLE} {...props} />
    </ContextForScreen>,
  )

/** The view the glow's gradient is drawn on, once there is one. */
const bloom = () =>
  screen.UNSAFE_root.findAll(
    (node) =>
      typeof node.type === "string" &&
      StyleSheet.flatten(node.props.style)?.experimental_backgroundImage !== undefined,
  )[0]

/** Matches the glow's bloom on Sent. */
const GLOW_BLOOM_MS = 600

const layOut = ({ width, height } = { width: 360, height: 800 }) =>
  fireEvent(screen.getByTestId(SUCCESS_SCREEN_TEST_ID), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
  })

const bloomScale = () => {
  const node = bloom()
  if (!node) throw new Error("no glow on screen")
  const [{ scale }] = getAnimatedStyle(node).transform as [{ scale: number }]
  return scale
}

/** The view that slides the title and extras in. */
const slidingText = () => {
  let node = screen.getByText(TITLE).parent
  while (node && getAnimatedStyle(node)?.opacity === undefined) node = node.parent
  if (!node) throw new Error("no sliding view above the title")
  return node
}

describe("SuccessScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.mocked(ReactNativeHapticFeedback.trigger).mockClear()
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {})
    jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear()
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(false)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("shows the badge, the title, the subtitle and the body", () => {
    renderScreen({ subtitle: "satoshi@blink.sv", children: <Text>Body</Text> })

    expect(screen.UNSAFE_getByType(SuccessBadge).props.size).toBe(49)
    expect(screen.getByText(TITLE)).toBeTruthy()
    expect(screen.getByText("satoshi@blink.sv")).toBeTruthy()
    expect(screen.getByText("Body")).toBeTruthy()
  })

  it("reads the title and subtitle as one header", () => {
    renderScreen({ subtitle: "satoshi@blink.sv" })

    const headers = screen.getAllByRole("header")
    expect(headers).toHaveLength(1)
    expect(headers[0].props).toMatchObject({
      accessible: true,
      accessibilityLabel: `${TITLE}, satoshi@blink.sv`,
    })
  })

  it("reads the title alone as the header when there is no subtitle", () => {
    renderScreen()

    expect(screen.getByRole("header").props.accessibilityLabel).toBe(TITLE)
  })

  /** In a centred column Android measures a bold line at its natural width and clipped
   *  the word it wrapped: "Your backup phrase is correct" lost "correct" on device. */
  it("runs the title and subtitle the full width, so no wrapped word is clipped", () => {
    renderScreen({ subtitle: "satoshi@blink.sv" })

    for (const text of [TITLE, "satoshi@blink.sv"]) {
      expect(StyleSheet.flatten(screen.getByText(text).props.style)).toMatchObject({
        width: "100%",
        textAlign: "center",
      })
    }
  })

  it("buzzes the success haptic once as it opens, not on re-render", () => {
    renderScreen()
    screen.rerender(
      <ContextForScreen>
        <SuccessScreen title={TITLE} subtitle="again" />
      </ContextForScreen>,
    )

    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledTimes(1)
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
      "notificationSuccess",
      { ignoreAndroidSystemSettings: true },
    )
  })

  it("speaks the title and subtitle together, once", () => {
    renderScreen({ subtitle: "satoshi@blink.sv" })
    act(() => jest.runOnlyPendingTimers())

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1)
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      `${TITLE}, satoshi@blink.sv`,
    )
  })

  it("speaks the title alone when there is no subtitle", () => {
    renderScreen()
    act(() => jest.runOnlyPendingTimers())

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1)
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(TITLE)
  })

  it("holds 3 s from the badge settling, not from opening", () => {
    expect(SUCCESS_HOLD_MS).toBe(3000)
    expect(SUCCESS_SCREEN_EXIT_MS).toBe(SUCCESS_BADGE_DURATION_MS + SUCCESS_HOLD_MS)

    const onHoldEnd = jest.fn()
    renderScreen({ onHoldEnd })

    act(() => jest.advanceTimersByTime(SUCCESS_SCREEN_EXIT_MS - 1))
    expect(onHoldEnd).not.toHaveBeenCalled()

    act(() => jest.advanceTimersByTime(1))
    expect(onHoldEnd).toHaveBeenCalledTimes(1)
  })

  it("keeps the hold running with a screen reader on, with no Continue button", async () => {
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true)
    const onHoldEnd = jest.fn()
    renderScreen({ onHoldEnd })
    await act(async () => {})

    expect(screen.queryByRole("button")).toBeNull()

    act(() => jest.advanceTimersByTime(SUCCESS_SCREEN_EXIT_MS))
    expect(onHoldEnd).toHaveBeenCalledTimes(1)
  })

  it("calls the latest handler when the caller re-renders mid-hold", () => {
    const first = jest.fn()
    const latest = jest.fn()
    renderScreen({ onHoldEnd: first })
    screen.rerender(
      <ContextForScreen>
        <SuccessScreen title={TITLE} onHoldEnd={latest} />
      </ContextForScreen>,
    )

    act(() => jest.advanceTimersByTime(SUCCESS_SCREEN_EXIT_MS))

    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
  })

  it("waits for a tap when it has actions", () => {
    const onHoldEnd = jest.fn()
    renderScreen({ onHoldEnd, actions: <Text>Okay</Text> })

    expect(screen.getByText("Okay")).toBeTruthy()

    act(() => jest.advanceTimersByTime(SUCCESS_SCREEN_EXIT_MS * 2))
    expect(onHoldEnd).not.toHaveBeenCalled()
  })

  it("never moves on once it has left the screen", () => {
    const onHoldEnd = jest.fn()
    renderScreen({ onHoldEnd })
    screen.unmount()

    act(() => jest.advanceTimersByTime(SUCCESS_SCREEN_EXIT_MS))
    expect(onHoldEnd).not.toHaveBeenCalled()
  })

  it("blooms the glow from the middle of the screen once it is laid out", () => {
    renderScreen()
    expect(bloom()).toBeUndefined()

    layOut()

    expect(StyleSheet.flatten(bloom()?.props.style)).toMatchObject({
      left: 180 - 800,
      top: 400 - 800,
      width: 1600,
      height: 1600,
    })
  })

  /** On a slow first open the layout landed after a bloom started at mount had run its
   *  course, and the glow only flashed. */
  it("starts the bloom when the glow is laid out, however late that is", () => {
    renderScreen()
    act(() => jest.advanceTimersByTime(GLOW_BLOOM_MS))
    layOut()

    expect(bloomScale()).toBeLessThan(0.01)

    act(() => jest.advanceTimersByTime(GLOW_BLOOM_MS))
    expect(bloomScale()).toBe(1)
  })

  it("does not restart the bloom when the screen is laid out again", () => {
    renderScreen()
    layOut()
    act(() => jest.advanceTimersByTime(GLOW_BLOOM_MS))
    layOut({ width: 360, height: 760 })

    expect(bloomScale()).toBe(1)
  })

  it("slides the title up 16 px into place once the check lands", () => {
    renderScreen()

    expect(getAnimatedStyle(slidingText())).toMatchObject({
      opacity: 0,
      transform: [{ translateY: 16 }],
    })

    act(() => jest.advanceTimersByTime(SUCCESS_BADGE_DURATION_MS))

    expect(getAnimatedStyle(slidingText())).toMatchObject({
      opacity: 1,
      transform: [{ translateY: 0 }],
    })
  })
})
