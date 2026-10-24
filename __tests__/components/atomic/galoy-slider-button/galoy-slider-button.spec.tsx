import React from "react"
import { StyleSheet, type ViewStyle } from "react-native"
import { type PanGesture, State } from "react-native-gesture-handler"
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import GaloySliderButton, {
  SLIDER_PAN_TEST_ID,
  SLIDER_TRACK_TEST_ID,
} from "@app/components/atomic/galoy-slider-button/galoy-slider-button"

import { ContextForScreen } from "../../../screens/helper"

// The busy border's frame loop crashes against fake timers; the arc is not under test.
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  ...jest.requireActual("react-native-reanimated"),
  useFrameCallback: jest.fn(),
}))

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

    it("paints the handle in the accent colour", async () => {
      await renderSlider({ accentColor: "#00A700" })
      expect(handleColor()).toBe("#00A700")
    })
  })

  describe("drag", () => {
    it("does not send on a partial drag", async () => {
      const onSwipe = await renderSlider()
      await drag(TRAVEL * 0.69)
      expect(onSwipe).not.toHaveBeenCalled()
      expect(screen.getByText("Slide to send")).toBeTruthy()
    })

    it("sends once the drag passes 70% of the travel", async () => {
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
    const labels = ["Reviewing", "Signing", "Oh oh"]

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

    it("moves to the next label every 3 seconds and holds on the last", async () => {
      await renderSlider({ busyLabels: labels, isLoading: true })

      // Separate acts: the typing interval starts in an effect after each label change.
      act(() => jest.advanceTimersByTime(3000))
      act(() => jest.advanceTimersByTime(typingTime("Signing")))
      expect(screen.getByText("Signing", { exact: false })).toBeTruthy()

      act(() => jest.advanceTimersByTime(3000 - typingTime("Signing")))
      act(() => jest.advanceTimersByTime(typingTime("Oh oh")))
      expect(screen.getByText("Oh oh", { exact: false })).toBeTruthy()

      act(() => jest.advanceTimersByTime(30000))
      expect(screen.getByText("Oh oh", { exact: false })).toBeTruthy()
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
})
