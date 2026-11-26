import React from "react"
import { AccessibilityInfo, StyleSheet, type ViewStyle } from "react-native"
import { type PanGesture, State } from "react-native-gesture-handler"
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"
import { getAnimatedStyle, useReducedMotion } from "react-native-reanimated"
import { act, configure, fireEvent, render, screen } from "@testing-library/react-native"

import GaloySliderButton, {
  SLIDER_PAN_TEST_ID,
  SLIDER_TRACK_TEST_ID,
} from "@app/components/atomic/galoy-slider-button/galoy-slider-button"

import { reportError } from "@app/utils/error-logging"

import { ContextForScreen } from "../../../screens/helper"

jest.mock("@app/utils/error-logging", () => ({ reportError: jest.fn() }))

// The busy border's frame loop crashes against fake timers; the arc is not under test.
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  ...jest.requireActual("react-native-reanimated"),
  useFrameCallback: jest.fn(),
  useReducedMotion: jest.fn(() => false),
}))

// The track's labels are drawn for sight and hidden from screen readers (the handle speaks
// for them), so text queries here must reach hidden elements.
configure({ defaultIncludeHiddenElements: true })

const TRACK_WIDTH = 350
const HANDLE_SIZE = 60
const TRAVEL = TRACK_WIDTH - HANDLE_SIZE

type Props = Partial<React.ComponentProps<typeof GaloySliderButton>>

const realSetImmediate: typeof setImmediate = jest.requireActual("timers").setImmediate

const renderSlider = async (props: Props = {}) => {
  const onSwipe = props.onSwipe ?? jest.fn()
  render(
    <ContextForScreen>
      <GaloySliderButton
        initialText="Slide to send"
        loadingText="Confirming"
        {...props}
        onSwipe={onSwipe}
      />
    </ContextForScreen>,
  )
  fireEvent(screen.getByTestId(SLIDER_TRACK_TEST_ID), "layout", {
    nativeEvent: { layout: { width: TRACK_WIDTH, height: 60, x: 0, y: 0 } },
  })
  // Gesture handler queues config updates on the setImmediate it bound at import,
  // before fake timers were installed, so wait a real tick for the new width to land.
  await act(async () => {
    await new Promise((resolve) => {
      realSetImmediate(resolve)
    })
  })
  return onSwipe
}

/** Drives the pan, then flushes the `runOnJS` hop, which goes through a faked microtask. */
const pan = (events: Parameters<typeof fireGestureHandler<PanGesture>>[1]) =>
  act(async () => {
    fireGestureHandler<PanGesture>(getByGestureTestId(SLIDER_PAN_TEST_ID), events)
    jest.runAllTicks()
  })

const drag = (distance: number) =>
  pan([
    { state: State.BEGAN, translationX: 0 },
    // The first ACTIVE event only starts the gesture; updates come after it.
    { state: State.ACTIVE, translationX: 0 },
    { state: State.ACTIVE, translationX: distance },
    { state: State.END, translationX: distance },
  ])

const typingTime = (text: string) => 35 * text.length

const handleOpacity = () => getAnimatedStyle(screen.getByTestId("slider")).opacity

const handleColor = () =>
  (StyleSheet.flatten(screen.getByTestId("slider").props.style) as ViewStyle)
    .backgroundColor

describe("GaloySliderButton", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("idle", () => {
    it("shows the initial label", async () => {
      await renderSlider()
      expect(screen.getByText("Slide to send")).toBeTruthy()
    })

    it("shows the disabled label while disabled", async () => {
      await renderSlider({ disabled: true, disabledText: "Calculating fee…" })
      expect(screen.getByText("Calculating fee…")).toBeTruthy()
      expect(screen.queryByText("Slide to send")).toBeNull()
    })

    it("falls back to the initial label when disabled without its own", async () => {
      await renderSlider({ disabled: true })
      expect(screen.getByText("Slide to send")).toBeTruthy()
    })

    it("ignores the disabled label while enabled", async () => {
      await renderSlider({ disabledText: "Calculating fee…" })
      expect(screen.queryByText("Calculating fee…")).toBeNull()
    })

    it("dims the handle while disabled", async () => {
      await renderSlider({ disabled: true })
      expect(handleOpacity()).toBe(0.5)
    })

    it("shows the handle at full strength while enabled", async () => {
      await renderSlider()
      expect(handleOpacity()).toBe(1)
    })

    it("paints the handle in the accent colour", async () => {
      await renderSlider({ accentColor: "#00A700" })
      expect(handleColor()).toBe("#00A700")
    })

    /* The handle rests on the start of the track, so the idle label keeps clear of it: at the
     * larger text sizes it otherwise grew under the handle and read as a half word. */
    it("keeps the idle label clear of the handle", async () => {
      await renderSlider()
      let node = screen.getByText("Slide to send").parent
      let padding: ViewStyle["paddingHorizontal"]
      while (node && padding === undefined) {
        padding = (StyleSheet.flatten(node.props.style) as ViewStyle | undefined)
          ?.paddingHorizontal
        node = node.parent
      }
      expect(padding).toBe(HANDLE_SIZE)
    })
  })

  describe("drag", () => {
    it("does not send on a partial drag", async () => {
      const onSwipe = await renderSlider()
      await drag(TRAVEL * 0.69)
      expect(onSwipe).not.toHaveBeenCalled()
      expect(screen.getByText("Slide to send")).toBeTruthy()
    })

    it("sends on release past 70% of the travel", async () => {
      const onSwipe = await renderSlider({
        onSwipe: jest.fn(() => new Promise(() => {})),
      })
      await drag(TRAVEL * 0.7)
      expect(onSwipe).toHaveBeenCalledTimes(1)
    })

    it("sends only once when the drag keeps going past the threshold", async () => {
      const onSwipe = await renderSlider({
        onSwipe: jest.fn(() => new Promise(() => {})),
      })
      await pan([
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: 0 },
        { state: State.ACTIVE, translationX: TRAVEL * 0.75 },
        { state: State.ACTIVE, translationX: TRAVEL * 0.9 },
        { state: State.ACTIVE, translationX: TRAVEL },
        { state: State.END, translationX: TRAVEL },
      ])
      expect(onSwipe).toHaveBeenCalledTimes(1)
    })

    it("does not send when dragged past 70% and back before release", async () => {
      const onSwipe = await renderSlider()
      await pan([
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: 0 },
        { state: State.ACTIVE, translationX: TRAVEL * 0.9 },
        { state: State.ACTIVE, translationX: TRAVEL * 0.5 },
        { state: State.END, translationX: TRAVEL * 0.5 },
      ])
      expect(onSwipe).not.toHaveBeenCalled()
    })

    it("does not send when the gesture is cancelled past 70%", async () => {
      // e.g. the conversion screen's outer pan taking the gesture over.
      const onSwipe = await renderSlider()
      await pan([
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: 0 },
        { state: State.ACTIVE, translationX: TRAVEL * 0.9 },
        { state: State.CANCELLED, translationX: TRAVEL * 0.9 },
      ])
      expect(onSwipe).not.toHaveBeenCalled()
    })

    it("confirms the send with a haptic", async () => {
      await renderSlider({ onSwipe: jest.fn(() => new Promise(() => {})) })
      await drag(TRAVEL)
      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith("impactMedium", {
        ignoreAndroidSystemSettings: true,
      })
    })

    // The handle fades out over the last tenth of the travel.
    for (const [at, opacity] of [
      [0.9, 1],
      [0.95, 0.5],
      [1, 0],
    ]) {
      it(`shows the handle at ${opacity} opacity at ${at * 100}% of the travel`, async () => {
        await renderSlider()
        // Held, not released: the glide's timing doesn't step under these fake timers.
        await pan([
          { state: State.BEGAN, translationX: 0 },
          { state: State.ACTIVE, translationX: 0 },
          { state: State.ACTIVE, translationX: TRAVEL * at },
        ])
        for (let i = 0; i < 5; i += 1) act(() => jest.advanceTimersByTime(16))
        expect(handleOpacity()).toBeCloseTo(opacity)
      })
    }

    it("reports a rejected onSwipe and returns to rest", async () => {
      const error = new Error("send failed")
      const onSwipe = await renderSlider({
        onSwipe: jest.fn(() => Promise.reject(error)),
      })
      await drag(TRAVEL)
      expect(reportError).toHaveBeenCalledWith("Slider onSwipe", error)
      await drag(TRAVEL)
      expect(onSwipe).toHaveBeenCalledTimes(2)
    })

    it("sends again after an onSwipe that settles at once", async () => {
      // e.g. a conversion re-quoting on swipe: `isLoading` never turns on in between.
      const onSwipe = await renderSlider({ onSwipe: jest.fn() })
      await drag(TRAVEL)
      await drag(TRAVEL)
      expect(onSwipe).toHaveBeenCalledTimes(2)
    })

    it("does not send while disabled", async () => {
      const onSwipe = await renderSlider({ disabled: true })
      await drag(TRAVEL)
      expect(onSwipe).not.toHaveBeenCalled()
    })

    it("does not send while loading", async () => {
      const onSwipe = await renderSlider({ isLoading: true })
      await drag(TRAVEL)
      expect(onSwipe).not.toHaveBeenCalled()
    })
  })

  describe("busy", () => {
    const labels = ["Reviewing", "Signing", "Hang tight"]

    it("locks into the busy state as soon as the send commits", async () => {
      await renderSlider({ busyLabels: labels, onSwipe: () => new Promise(() => {}) })
      await drag(TRAVEL)
      act(() => jest.advanceTimersByTime(typingTime("Reviewing")))
      expect(screen.getByText("Reviewing", { exact: false })).toBeTruthy()
      expect(screen.queryByText("Slide to send")).toBeNull()
    })

    it("types each label in", async () => {
      await renderSlider({ busyLabels: labels, isLoading: true })
      act(() => jest.advanceTimersByTime(35 * 3))
      expect(screen.getByText("Rev", { exact: false })).toBeTruthy()
      expect(screen.queryByText("Reviewing", { exact: false })).toBeNull()
    })

    it("types a character together with the marks on it", async () => {
      // Thai "ก่อน": the tone mark ่ belongs to ก and never shows on its own.
      await renderSlider({ busyLabels: ["ก่อน"], isLoading: true })
      act(() => jest.advanceTimersByTime(35))
      expect(screen.getByText("ก่", { exact: false })).toBeTruthy()
      act(() => jest.advanceTimersByTime(35))
      expect(screen.getByText("ก่อ", { exact: false })).toBeTruthy()
    })

    it("shows each label whole with reduce motion on", async () => {
      jest.mocked(useReducedMotion).mockReturnValue(true)
      try {
        await renderSlider({ busyLabels: labels, isLoading: true })
        expect(screen.getByText("Reviewing...")).toBeTruthy()

        act(() => jest.advanceTimersByTime(3000))
        expect(screen.getByText("Signing...")).toBeTruthy()
      } finally {
        jest.mocked(useReducedMotion).mockReturnValue(false)
      }
    })

    it("moves to the next label every 3 seconds and holds on the last", async () => {
      await renderSlider({ busyLabels: labels, isLoading: true })

      // Separate acts: the typing interval starts in an effect after each label change.
      act(() => jest.advanceTimersByTime(3000))
      act(() => jest.advanceTimersByTime(typingTime("Signing")))
      expect(screen.getByText("Signing", { exact: false })).toBeTruthy()

      act(() => jest.advanceTimersByTime(3000 - typingTime("Signing")))
      act(() => jest.advanceTimersByTime(typingTime("Hang tight")))
      expect(screen.getByText("Hang tight", { exact: false })).toBeTruthy()

      act(() => jest.advanceTimersByTime(30000))
      expect(screen.getByText("Hang tight", { exact: false })).toBeTruthy()
      expect(screen.queryByText("Reviewing", { exact: false })).toBeNull()
    })

    it("shows the loading label when no labels rotate", async () => {
      await renderSlider({ isLoading: true })
      expect(screen.getByText("Confirming")).toBeTruthy()
    })

    it("stays busy while the parent is still loading after the swipe settles", async () => {
      let settle = () => {}
      const onSwipe = () =>
        new Promise<void>((resolve) => {
          settle = resolve
        })
      render(
        <ContextForScreen>
          <GaloySliderButton
            initialText="Slide to send"
            loadingText="Confirming"
            onSwipe={onSwipe}
            isLoading
          />
        </ContextForScreen>,
      )
      await act(async () => settle())
      expect(screen.getByText("Confirming")).toBeTruthy()
    })

    it("returns to rest once the send settles without leaving the screen", async () => {
      let settle = () => {}
      await renderSlider({
        onSwipe: () =>
          new Promise<void>((resolve) => {
            settle = resolve
          }),
      })
      await drag(TRAVEL)
      expect(screen.getByText("Confirming")).toBeTruthy()

      await act(async () => settle())
      expect(screen.getByText("Slide to send")).toBeTruthy()
      expect(screen.queryByText("Confirming")).toBeNull()
    })
  })

  /** A screen reader, Switch Control or Voice Control can't drag the handle. */
  describe("screen reader", () => {
    const handle = () => screen.getByTestId("slider")
    const activate = () =>
      act(async () => {
        fireEvent(handle(), "accessibilityAction", {
          nativeEvent: { actionName: "activate" },
        })
      })

    it("reads the handle as a button named for the track's label", async () => {
      await renderSlider()

      expect(handle().props.accessibilityRole).toBe("button")
      expect(handle().props.accessibilityLabel).toBe("Slide to send")
      expect(handle().props.accessibilityActions).toEqual([{ name: "activate" }])
    })

    it("announces the busy label on activate", async () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility")
      await renderSlider({
        busyLabels: ["Reviewing", "Signing"],
        onSwipe: () => new Promise<void>(() => {}),
      })

      await activate()

      expect(announce).toHaveBeenCalledWith("Reviewing")
      announce.mockRestore()
    })

    it("turns busy on activate, as a full slide does", async () => {
      await renderSlider({ onSwipe: () => new Promise<void>(() => {}) })

      await activate()

      expect(handle().props.accessibilityLabel).toBe("Confirming")
      expect(handle().props.accessibilityState).toEqual({ disabled: true, busy: true })
    })

    it("counts one send for repeated activates", async () => {
      const onSwipe = jest.fn(() => new Promise<void>(() => {}))
      await renderSlider({ onSwipe })

      await activate()
      await activate()

      expect(onSwipe).toHaveBeenCalledTimes(1)
    })

    it("counts one send for activates that land before the busy render", async () => {
      // Two in one tick: the second can't see `busy` yet, only the handle's lock.
      const onSwipe = jest.fn(() => new Promise<void>(() => {}))
      await renderSlider({ onSwipe })

      await act(async () => {
        const event = { nativeEvent: { actionName: "activate" } }
        fireEvent(handle(), "accessibilityAction", event)
        fireEvent(handle(), "accessibilityAction", event)
      })

      expect(onSwipe).toHaveBeenCalledTimes(1)
    })

    it("sends again on a second activate after an onSwipe that settles at once", async () => {
      const onSwipe = jest.fn()
      await renderSlider({ onSwipe })

      await activate()
      await activate()

      expect(onSwipe).toHaveBeenCalledTimes(2)
    })

    it("ignores activate while disabled and says so", async () => {
      const onSwipe = jest.fn()
      await renderSlider({ onSwipe, disabled: true, disabledText: "Calculating fee" })

      await activate()

      expect(onSwipe).not.toHaveBeenCalled()
      expect(handle().props.accessibilityLabel).toBe("Calculating fee")
      expect(handle().props.accessibilityState).toEqual({ disabled: true, busy: false })
    })
  })
})
