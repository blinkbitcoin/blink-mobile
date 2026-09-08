import React from "react"
import { StyleSheet, Text, View } from "react-native"
import type { ReactTestInstance } from "react-test-renderer"
import { getAnimatedStyle } from "react-native-reanimated"
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils"
import type { PanGesture } from "react-native-gesture-handler"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"

import { BOTTOM_OVERHANG, BottomSheet, PAN_TEST_ID } from "@app/components/bottom-sheet"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../../screens/helper"

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const SHEET_TEST_ID = "sheet"

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
})
