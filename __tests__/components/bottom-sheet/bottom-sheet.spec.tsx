import React from "react"
import { StyleSheet, Text, View } from "react-native"
import type { ReactTestInstance } from "react-test-renderer"
import { getAnimatedStyle } from "react-native-reanimated"
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils"
import type { PanGesture } from "react-native-gesture-handler"
import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native"

import { BOTTOM_OVERHANG, BottomSheet, PAN_TEST_ID } from "@app/components/bottom-sheet"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../../screens/helper"

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

// `useScrollViewOffset` measures a real scroll view through an animated ref,
// which never resolves under jest — every run logs "animatedRef is not
// initialized" and the value stays 0, so the pan's scroll-versus-drag guard is
// unreachable without standing in for it. Only that one hook is replaced; the
// rest of reanimated is the real thing, since gesture-handler is built on it.
//
// The guard reads the offset once per drag update, so a test lists one reading
// per update and the last one holds for everything after.
let mockScrollReads: number[] = [0]
const mockScrollOffset = {
  get value() {
    return (
      (mockScrollReads.length > 1 ? mockScrollReads.shift() : mockScrollReads[0]) ?? 0
    )
  },
}
const scrollReads = (...values: number[]) => {
  mockScrollReads = values
}

/**
 * Long enough for a dismissal to have finished. `onClose` is called from the
 * slide-out's completion rather than from the release, so "it did not close"
 * only means anything once the slide-out has had its time.
 */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, CLOSE_DURATION_MS + 100)
    })
  })

/** Matches the sheet's own, which it does not export. */
const CLOSE_DURATION_MS = 200

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  ...jest.requireActual("react-native-reanimated"),
  useScrollViewOffset: () => mockScrollOffset,
}))

const SHEET_TEST_ID = "sheet"

/**
 * Where the sheet is right now. A spring is never exactly at rest, so anything
 * asserted against this wants a pixel of slack rather than an equality.
 */
const translateYOf = (sheet: ReactTestInstance) =>
  (getAnimatedStyle(sheet).transform as [{ translateY: number }])[0].translateY

/** The height the sheet's offsets are expressed in, not the one it is drawn at. */
const animatedHeightOf = (sheet: ReactTestInstance) =>
  (StyleSheet.flatten(sheet.props.style).height as number) - BOTTOM_OVERHANG

const renderSheet = (props: Partial<React.ComponentProps<typeof BottomSheet>> = {}) =>
  render(
    <ContextForScreen>
      <BottomSheet
        testID={SHEET_TEST_ID}
        isVisible
        onClose={jest.fn()}
        heightRatio={0.6}
        {...props}
      >
        <Text>content</Text>
      </BottomSheet>
    </ContextForScreen>,
  )

beforeEach(() => {
  jest.clearAllMocks()
  loadLocale("en")
  // At the top of its list, which is where every test that does not say
  // otherwise expects to find it.
  scrollReads(0)
})

describe("BottomSheet", () => {
  it("draws what it was given", async () => {
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("content")).toBeTruthy())
  })

  it("holds the header above the scroll, so it stays put as the content moves", async () => {
    const { getByTestId, getByText } = renderSheet({
      header: <Text>title</Text>,
      headerTestID: "sheet-header",
    })

    await waitFor(() => expect(getByText("title")).toBeTruthy())
    // Inside the header region rather than loose among the children.
    expect(getByTestId("sheet-header")).toBeTruthy()
  })

  it("renders nothing where the header would be when it has none", async () => {
    const { queryByTestId, getByText } = renderSheet({ headerTestID: "sheet-header" })

    await waitFor(() => expect(getByText("content")).toBeTruthy())
    expect(queryByTestId("sheet-header")).toBeNull()
  })

  it("closes when the scrim behind it is pressed", async () => {
    const onClose = jest.fn()
    const { getByLabelText } = renderSheet({ onClose })

    await waitFor(() => expect(getByLabelText("Close")).toBeTruthy())
    fireEvent.press(getByLabelText("Close"))

    expect(onClose).toHaveBeenCalled()
  })

  it("closes when it is dragged down past the dismiss distance", async () => {
    const onClose = jest.fn()
    const { getByTestId } = renderSheet({ onClose })

    const sheet = await waitFor(() => getByTestId(SHEET_TEST_ID))

    // Far enough down to be a dismissal rather than a resize, and released
    // without any throw of its own so only the distance decides.
    await act(async () => {
      fireGestureHandler<PanGesture>(getByGestureTestId(PAN_TEST_ID), [
        { translationY: 0, velocityY: 0 },
        { translationY: 200, velocityY: 0 },
        { state: 5, translationY: 200, velocityY: 0 },
      ])
    })

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    // And it left by sliding out rather than vanishing.
    expect(getAnimatedStyle(sheet)).toMatchObject({
      transform: [{ translateY: animatedHeightOf(sheet) }],
    })
  })

  it("stays open when the drag is too short to be a dismissal", async () => {
    const onClose = jest.fn()
    renderSheet({ onClose })

    await act(async () => {
      fireGestureHandler<PanGesture>(getByGestureTestId(PAN_TEST_ID), [
        { translationY: 0, velocityY: 0 },
        { translationY: 20, velocityY: 0 },
        { state: 5, translationY: 20, velocityY: 0 },
      ])
    })

    expect(onClose).not.toHaveBeenCalled()
  })

  it("rests at the header's bottom edge when it is asked to, not fully open", async () => {
    const { getByTestId } = renderSheet({
      restsOnHeader: true,
      header: <Text>title</Text>,
      headerTestID: "sheet-header",
    })

    const sheet = await waitFor(() => getByTestId(SHEET_TEST_ID))
    const sheetHeight = animatedHeightOf(sheet)

    // Until the header has been measured it stays off-screen rather than
    // guessing where it should stop.
    expect(getAnimatedStyle(sheet)).toMatchObject({
      transform: [{ translateY: sheetHeight }],
    })

    await act(async () => {
      fireEvent(getByTestId("sheet-header"), "layout", {
        nativeEvent: { layout: { x: 0, y: 24, width: 300, height: 120 } },
      })
    })

    // y + height, since the handle above the header is inside the window too.
    await waitFor(() =>
      expect(getAnimatedStyle(sheet)).toMatchObject({
        transform: [{ translateY: sheetHeight - (24 + 120) }],
      }),
    )
  })

  it("opens fully when it has no header to rest on", async () => {
    const { getByTestId } = renderSheet()

    const sheet = await waitFor(() => getByTestId(SHEET_TEST_ID))
    await waitFor(() =>
      expect(getAnimatedStyle(sheet)).toMatchObject({ transform: [{ translateY: 0 }] }),
    )
  })

  it("takes itself off the screen once it is no longer visible", async () => {
    const { queryByText, getByText, rerender } = renderSheet()
    await waitFor(() => expect(getByText("content")).toBeTruthy())

    rerender(
      <ContextForScreen>
        <BottomSheet
          testID={SHEET_TEST_ID}
          isVisible={false}
          onClose={jest.fn()}
          heightRatio={0.6}
        >
          <View />
        </BottomSheet>
      </ContextForScreen>,
    )

    // The modal window closes with it, so the slide-out plays against a hidden
    // window rather than on screen. That is how it behaved before the sheet was
    // shared and is left alone here; see the PR notes.
    await waitFor(() => expect(queryByText("content")).toBeNull())
  })
  it("holds a footer below the scroll, so a call to action stays on the sheet", async () => {
    const { getByText, getByTestId } = renderSheet({
      footer: <Text>Submit</Text>,
      scrollTestID: "sheet-scroll",
    })

    await waitFor(() => expect(getByText("Submit")).toBeTruthy())
    // Outside the scroll rather than at the end of it, so the content cannot
    // push it off the sheet.
    expect(within(getByTestId("sheet-scroll")).queryByText("Submit")).toBeNull()
  })

  it("does not dismiss on a flick that only sent the list back to the top", async () => {
    const onClose = jest.fn()
    const { getByTestId } = renderSheet({ onClose })

    const sheet = await waitFor(() => getByTestId(SHEET_TEST_ID))
    await waitFor(() =>
      expect(getAnimatedStyle(sheet)).toMatchObject({ transform: [{ translateY: 0 }] }),
    )

    // Read to the bottom of a long list, then flicked down to get back to the
    // top. The release velocity is an ordinary one for a flick, and on its own
    // it projects far past the dismiss distance — but the sheet never moved,
    // because the list took every frame of the drag.
    scrollReads(300)
    await act(async () => {
      fireGestureHandler<PanGesture>(getByGestureTestId(PAN_TEST_ID), [
        { translationY: 0, velocityY: 0 },
        { translationY: 40, velocityY: 3000 },
        { state: 5, translationY: 40, velocityY: 3000 },
      ])
    })
    await settle()

    expect(onClose).not.toHaveBeenCalled()
    expect(getAnimatedStyle(sheet)).toMatchObject({ transform: [{ translateY: 0 }] })
  })

  it("picks the drag up where the list ran out rather than jumping it all at once", async () => {
    const onClose = jest.fn()
    const { getByTestId } = renderSheet({ onClose })

    const sheet = await waitFor(() => getByTestId(SHEET_TEST_ID))
    await waitFor(() =>
      expect(getAnimatedStyle(sheet)).toMatchObject({ transform: [{ translateY: 0 }] }),
    )

    // 150 of the drag scrolled the list back to its top and only the last 50
    // belong to the sheet. The whole 200 would be a dismissal; the 50 that are
    // actually the sheet's are not, so it stays.
    scrollReads(300, 0)
    await act(async () => {
      fireGestureHandler<PanGesture>(getByGestureTestId(PAN_TEST_ID), [
        { translationY: 0, velocityY: 0 },
        { translationY: 150, velocityY: 0 },
        { translationY: 200, velocityY: 0 },
        { state: 5, translationY: 200, velocityY: 0 },
      ])
    })
    await settle()

    expect(onClose).not.toHaveBeenCalled()
    // And it sprang back home, rather than being carried off by the 150 that
    // were never its to travel.
    expect(Math.abs(translateYOf(sheet))).toBeLessThan(1)
  })

  it("dismisses on a short drag thrown hard enough to be going away", async () => {
    const onClose = jest.fn()
    const { getByTestId } = renderSheet({ onClose })

    // Fully arrived first: dragged mid-entry the sheet is already far down the
    // screen, and the distance alone would carry the decision.
    const sheet = await waitFor(() => getByTestId(SHEET_TEST_ID))
    await waitFor(() => expect(translateYOf(sheet)).toBe(0))

    // Twenty pixels is nowhere near the dismiss distance standing still — the
    // test above proves it stays — but thrown at 3,000 px/s it is on its way
    // out, and the sheet goes where it was thrown rather than where it stopped.
    await act(async () => {
      fireGestureHandler<PanGesture>(getByGestureTestId(PAN_TEST_ID), [
        { translationY: 0, velocityY: 0 },
        { translationY: 20, velocityY: 3000 },
        { state: 5, translationY: 20, velocityY: 3000 },
      ])
    })

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it("expands on a short drag thrown hard enough to be going up", async () => {
    const { getByTestId } = renderSheet({
      restsOnHeader: true,
      header: <Text>title</Text>,
      headerTestID: "sheet-header",
      scrollTestID: "sheet-scroll",
    })

    const sheet = await waitFor(() => getByTestId(SHEET_TEST_ID))
    const sheetHeight = animatedHeightOf(sheet)

    await act(async () => {
      fireEvent(getByTestId("sheet-header"), "layout", {
        nativeEvent: { layout: { x: 0, y: 24, width: 300, height: 120 } },
      })
    })
    const restOffset = sheetHeight - (24 + 120)
    await waitFor(() =>
      expect(getAnimatedStyle(sheet)).toMatchObject({
        transform: [{ translateY: restOffset }],
      }),
    )

    // Below full height the list is locked, since the sheet itself is taking
    // the drag.
    expect(getByTestId("sheet-scroll").props.scrollEnabled).toBe(false)

    // Twenty pixels of travel is not halfway to the top, so only the throw can
    // decide this one.
    await act(async () => {
      fireGestureHandler<PanGesture>(getByGestureTestId(PAN_TEST_ID), [
        { translationY: 0, velocityY: 0 },
        { translationY: -20, velocityY: -3000 },
        { state: 5, translationY: -20, velocityY: -3000 },
      ])
    })

    await waitFor(() =>
      expect(getAnimatedStyle(sheet)).toMatchObject({ transform: [{ translateY: 0 }] }),
    )
    // And now that it is up, the list it holds is the thing that scrolls.
    expect(getByTestId("sheet-scroll").props.scrollEnabled).toBe(true)
  })

  describe("inline", () => {
    it("puts up no scrim, so what it sits beside keeps its own touches", async () => {
      const { getByText, queryByLabelText } = renderSheet({ presentation: "inline" })

      await waitFor(() => expect(getByText("content")).toBeTruthy())
      // The scrim is the only thing that presses to close, and it is what would
      // be swallowing the panning of the map this sits beside.
      expect(queryByLabelText("Close")).toBeNull()
    })

    it("is still dragged away the same way the modal one is", async () => {
      const onClose = jest.fn()
      renderSheet({ presentation: "inline", onClose })

      await act(async () => {
        fireGestureHandler<PanGesture>(getByGestureTestId(PAN_TEST_ID), [
          { translationY: 0, velocityY: 0 },
          { translationY: 200, velocityY: 0 },
          { state: 5, translationY: 200, velocityY: 0 },
        ])
      })

      await waitFor(() => expect(onClose).toHaveBeenCalled())
    })

    it("takes no height of its own, so its parent decides the split", async () => {
      const { getByTestId } = renderSheet({ presentation: "inline" })

      const sheet = await waitFor(() => getByTestId(SHEET_TEST_ID))
      const style = StyleSheet.flatten(sheet.props.style)

      // A `flex` share rather than a measured height: the map above it shrinks
      // by exactly this, instead of being covered by it.
      expect(style.height).toBeUndefined()
      expect(style.flex).toBe(1)
    })

    it("draws nothing at all when it is not visible", async () => {
      const { queryByText } = renderSheet({ presentation: "inline", isVisible: false })

      await waitFor(() => expect(queryByText("content")).toBeNull())
    })
  })
})
