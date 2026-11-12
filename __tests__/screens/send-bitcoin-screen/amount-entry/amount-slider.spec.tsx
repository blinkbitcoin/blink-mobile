import { it } from "@jest/globals"
import React from "react"
import { StyleSheet, type ViewStyle } from "react-native"
import { type PanGesture, State } from "react-native-gesture-handler"
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import {
  AMOUNT_SLIDER_BADGE_TEST_ID,
  AMOUNT_SLIDER_PAN_TEST_ID,
  AMOUNT_SLIDER_TEST_ID,
  AMOUNT_SLIDER_TRACK_TEST_ID,
  AmountSlider,
} from "@app/screens/send-bitcoin-screen/amount-entry/amount-slider"
import { haptics } from "@app/utils/haptics"

import { ContextForScreen } from "../../helper"

const mockWindow = { width: 360, height: 800, scale: 2, fontScale: 1 }
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}))

jest.mock("@app/utils/haptics", () => ({
  haptics: { grab: jest.fn(), select: jest.fn() },
}))

loadLocale("en")
const LL = i18nObject("en")

/** The touch box reaches 16 past each end of the track; the thumb rests 5 in from each end. */
const TOUCH_PADDING_HORIZONTAL = 16
const THUMB_INSET = 5
const TRACK_WIDTH = 270
const TRAVEL = TRACK_WIDTH - 2 * THUMB_INSET

/** Where a finger sits, in the touch box, to point at a percent of the track. */
const xAt = (percent: number) =>
  TOUCH_PADDING_HORIZONTAL + THUMB_INSET + (percent / 100) * TRAVEL

const realSetImmediate: typeof setImmediate = jest.requireActual("timers").setImmediate

type Props = Partial<React.ComponentProps<typeof AmountSlider>>

const renderSlider = async (props: Props = {}) => {
  const onSlide = props.onSlide ?? jest.fn()
  render(
    <ContextForScreen>
      <AmountSlider share={0} {...props} onSlide={onSlide} />
    </ContextForScreen>,
  )
  fireEvent(screen.getByTestId(AMOUNT_SLIDER_TRACK_TEST_ID), "layout", {
    nativeEvent: { layout: { width: TRACK_WIDTH, height: 4, x: 0, y: 0 } },
  })
  // Gesture handler applies config on the setImmediate it bound at import.
  await act(async () => {
    await new Promise((resolve) => {
      realSetImmediate(resolve)
    })
  })
  return onSlide
}

/** Drives the pan, then flushes the `runOnJS` hops, which go through a faked microtask. */
const pan = (events: Parameters<typeof fireGestureHandler<PanGesture>>[1]) =>
  act(async () => {
    fireGestureHandler<PanGesture>(getByGestureTestId(AMOUNT_SLIDER_PAN_TEST_ID), events)
    jest.runAllTicks()
  })

/** Takes the thumb at `from`, moves it to `to` and lets it go there. */
const drag = (from: number, to: number) =>
  pan([
    { state: State.BEGAN, x: xAt(from) },
    // The first ACTIVE event only starts the gesture; updates come after it.
    { state: State.ACTIVE, x: xAt(from) },
    { state: State.ACTIVE, x: xAt(to) },
    { state: State.END, x: xAt(to) },
  ])

const touchAreaWidth = () =>
  (StyleSheet.flatten(screen.getByTestId(AMOUNT_SLIDER_TEST_ID).props.style) as ViewStyle)
    .width

describe("AmountSlider", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockWindow.width = 360
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("width", () => {
    // Figma's 270 track on a 360 screen, plus the 16 of touch box past each end.
    it.each([
      [360, 270 + 32],
      [320, 240 + 32],
      [412, 309 + 32],
    ])(
      "keeps the track at 270/360 of a %i wide screen",
      async (screenWidth, expected) => {
        mockWindow.width = screenWidth
        await renderSlider()

        expect(touchAreaWidth()).toBe(expected)
      },
    )

    it("fits inside the 20 side padding of a 320 screen", async () => {
      mockWindow.width = 320
      await renderSlider()

      expect(touchAreaWidth()).toBeLessThanOrEqual(320 - 2 * 20)
    })
  })

  describe("hint", () => {
    it("shows 'Slide to select amount' by default", async () => {
      await renderSlider()

      expect(screen.getByText(LL.SendBitcoinScreen.slideToSelectAmount())).toBeTruthy()
    })

    it("leaves it out once the sender has learned the slider", async () => {
      await renderSlider({ showHint: false })

      expect(screen.queryByText(LL.SendBitcoinScreen.slideToSelectAmount())).toBeNull()
    })
  })

  describe("dragging", () => {
    it("reports each whole percent the thumb passes", async () => {
      const onSlide = await renderSlider()

      await drag(0, 50)

      expect(onSlide).toHaveBeenCalledWith(0)
      expect(onSlide).toHaveBeenLastCalledWith(50)
    })

    it("snaps to 100% from 96%", async () => {
      const onSlide = await renderSlider()

      await drag(0, 97)

      expect(onSlide).toHaveBeenLastCalledWith(100)
    })

    it("stays below 100% under 96%", async () => {
      const onSlide = await renderSlider()

      await drag(0, 95)

      expect(onSlide).toHaveBeenLastCalledWith(95)
    })

    it("buzzes a grab on taking the thumb, and one tick on reaching 100%", async () => {
      await renderSlider()

      await drag(0, 99)

      expect(haptics.grab).toHaveBeenCalledTimes(1)
      expect(haptics.select).toHaveBeenCalledTimes(1)
    })

    it("buzzes no tick below 100%", async () => {
      await renderSlider()

      await drag(0, 60)

      expect(haptics.select).not.toHaveBeenCalled()
    })

    // jest-utils always closes a gesture with END, so the held badge itself can't be caught.
    it("takes the percent badge away once the thumb is let go", async () => {
      await renderSlider()

      await drag(0, 40)

      expect(screen.queryByTestId(AMOUNT_SLIDER_BADGE_TEST_ID)).toBeNull()
    })

    it("tells the screen when the thumb is taken and let go", async () => {
      const onHoldChange = jest.fn()
      await renderSlider({ onHoldChange })

      await drag(0, 30)

      expect(onHoldChange.mock.calls).toEqual([[true], [false]])
    })
  })

  describe("typed amount", () => {
    it("shows no percent badge when the share changes from outside", async () => {
      await renderSlider({ share: 0.25 })

      expect(screen.queryByTestId(AMOUNT_SLIDER_BADGE_TEST_ID)).toBeNull()
    })
  })
})
