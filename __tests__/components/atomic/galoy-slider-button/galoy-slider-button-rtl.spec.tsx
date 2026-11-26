import React from "react"
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

// The slider reads the layout direction once, at import, so this file runs right to left.
jest.mock("react-native/Libraries/ReactNative/I18nManager", () => {
  const actual = jest.requireActual("react-native/Libraries/ReactNative/I18nManager")
  return { __esModule: true, default: { ...actual.default, isRTL: true } }
})

// The busy border's frame loop crashes against fake timers; the arc is not under test.
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  ...jest.requireActual("react-native-reanimated"),
  useFrameCallback: jest.fn(),
}))

const TRACK_WIDTH = 350
const TRAVEL = TRACK_WIDTH - 60

const realSetImmediate: typeof setImmediate = jest.requireActual("timers").setImmediate

const renderSlider = async () => {
  const onSwipe = jest.fn(() => new Promise<void>(() => {}))
  render(
    <ContextForScreen>
      <GaloySliderButton
        initialText="Slide to send"
        loadingText="Confirming"
        onSwipe={onSwipe}
      />
    </ContextForScreen>,
  )
  fireEvent(screen.getByTestId(SLIDER_TRACK_TEST_ID), "layout", {
    nativeEvent: { layout: { width: TRACK_WIDTH, height: 60, x: 0, y: 0 } },
  })
  // Gesture handler queues config updates on the setImmediate it bound at import.
  await act(async () => {
    await new Promise((resolve) => {
      realSetImmediate(resolve)
    })
  })
  return onSwipe
}

const drag = (distance: number) =>
  act(async () => {
    fireGestureHandler<PanGesture>(getByGestureTestId(SLIDER_PAN_TEST_ID), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: 0 },
      { state: State.ACTIVE, translationX: distance },
      { state: State.END, translationX: distance },
    ])
    jest.runAllTicks()
  })

describe("GaloySliderButton, right to left", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("sends on a leftward drag", async () => {
    const onSwipe = await renderSlider()
    await drag(-TRAVEL)
    expect(onSwipe).toHaveBeenCalledTimes(1)
  })

  it("does not send on a rightward drag", async () => {
    const onSwipe = await renderSlider()
    await drag(TRAVEL)
    expect(onSwipe).not.toHaveBeenCalled()
  })
})
