import React from "react"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"
import { StyleSheet } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { SCRIM_TEST_ID } from "@app/components/bottom-sheet"
import { ErrorMsgBottomSheet } from "@app/components/error-msg-bottom-sheet"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { ContextForScreen } from "../../screens/helper"

const HOME_INDICATOR = 34

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: HOME_INDICATOR, left: 0, right: 0 }),
}))

const SHEET_TEST_ID = "error-sheet"

const renderSheet = (
  props: Partial<React.ComponentProps<typeof ErrorMsgBottomSheet>> = {},
) => {
  const handlers = { onClose: jest.fn(), onPrimaryPress: jest.fn() }
  render(
    <ContextForScreen>
      <ErrorMsgBottomSheet
        isVisible
        title="A small problem"
        body="The payment could not be completed."
        primaryLabel="Try again"
        testID={SHEET_TEST_ID}
        {...handlers}
        {...props}
      />
    </ContextForScreen>,
  )
  return handlers
}

beforeEach(() => {
  loadLocale("en")
})

describe("ErrorMsgBottomSheet", () => {
  it("shows the title, the body and the one action", () => {
    renderSheet()

    expect(screen.getByText("A small problem")).toBeTruthy()
    expect(screen.getByText("The payment could not be completed.")).toBeTruthy()
    expect(screen.getByText("Try again")).toBeTruthy()
  })

  it("runs the action without closing on its own", () => {
    const { onClose, onPrimaryPress } = renderSheet()

    fireEvent.press(screen.getByText("Try again"))

    expect(onPrimaryPress).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it("closes from the scrim without running the action", async () => {
    const { onClose, onPrimaryPress } = renderSheet()

    await act(async () => {
      fireEvent.press(screen.getByTestId(SCRIM_TEST_ID, { includeHiddenElements: true }))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPrimaryPress).not.toHaveBeenCalled()
  })

  it("takes no action from a tap that lands while it slides out", async () => {
    const onSecondaryPress = jest.fn()
    const props = {
      title: "A small problem",
      body: "The payment could not be completed.",
      primaryLabel: "Try again",
      secondaryLabel: "Accept $2.89 fee",
      onClose: jest.fn(),
      onPrimaryPress: jest.fn(),
      onSecondaryPress,
      testID: SHEET_TEST_ID,
    }
    const { rerender } = render(
      <ContextForScreen>
        <ErrorMsgBottomSheet isVisible {...props} />
      </ContextForScreen>,
    )
    const primary = screen.getByText("Try again")
    const secondary = screen.getByText("Accept $2.89 fee")

    rerender(
      <ContextForScreen>
        <ErrorMsgBottomSheet isVisible={false} {...props} />
      </ContextForScreen>,
    )
    fireEvent.press(primary)
    fireEvent.press(secondary)

    expect(props.onPrimaryPress).not.toHaveBeenCalled()
    expect(onSecondaryPress).not.toHaveBeenCalled()
  })

  it("offers no second action unless one is given", () => {
    renderSheet()

    expect(screen.queryByText("Accept $2.89 fee")).toBeNull()
  })

  it("runs the secondary action on its own, without the primary or a close", () => {
    const onSecondaryPress = jest.fn()
    const { onClose, onPrimaryPress } = renderSheet({
      secondaryLabel: "Accept $2.89 fee",
      onSecondaryPress,
    })

    fireEvent.press(screen.getByText("Accept $2.89 fee"))

    expect(onSecondaryPress).toHaveBeenCalledTimes(1)
    expect(onPrimaryPress).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("draws nothing while hidden", () => {
    renderSheet({ isVisible: false })

    expect(screen.queryByTestId(SHEET_TEST_ID)).toBeNull()
  })

  it("keeps the action 20 above the home indicator, like every screen's bottom CTA", () => {
    renderSheet()

    const content = screen.getByText("Try again").parent
    let node = content
    while (node && StyleSheet.flatten(node.props.style)?.paddingBottom === undefined) {
      node = node.parent
    }
    expect(StyleSheet.flatten(node?.props.style).paddingBottom).toBe(HOME_INDICATOR + 20)
  })

  it("outlines the top edge only, with no border down the sides", () => {
    renderSheet()

    const sheet = StyleSheet.flatten(screen.getByTestId(SHEET_TEST_ID).props.style)
    expect(sheet.borderWidth).toBe(1)
    expect(sheet.borderBottomWidth).toBe(0)
    expect(sheet.borderLeftWidth).toBe(0)
    expect(sheet.borderRightWidth).toBe(0)
  })

  describe("screen reader", () => {
    /** Read first, a full-screen "Close" stood between a screen reader and the message. */
    it("keeps the scrim out of reach, so the title is read first", () => {
      renderSheet()

      expect(screen.queryByTestId(SCRIM_TEST_ID)).toBeNull()
      expect(screen.queryByLabelText(i18nObject("en").common.close())).toBeNull()
      expect(screen.getByRole("header", { name: "A small problem" })).toBeTruthy()
    })

    it("holds a screen reader inside the sheet and closes on its escape gesture", async () => {
      const { onClose, onPrimaryPress } = renderSheet()
      const sheet = screen.getByTestId(SHEET_TEST_ID)

      expect(sheet.props.accessibilityViewIsModal).toBe(true)
      await act(async () => {
        fireEvent(sheet, "accessibilityEscape")
      })

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onPrimaryPress).not.toHaveBeenCalled()
    })
  })
  describe("haptic", () => {
    beforeEach(() => {
      ;(ReactNativeHapticFeedback.trigger as jest.Mock).mockClear()
    })

    it("buzzes the error haptic as it opens, for errors and warnings alike", () => {
      renderSheet()

      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
        "notificationError",
        expect.anything(),
      )
    })

    it("stays silent for a notice: nothing failed", () => {
      renderSheet({ hasHaptic: false })

      expect(ReactNativeHapticFeedback.trigger).not.toHaveBeenCalled()
    })

    /** It stays mounted and only toggles `isVisible`, so each opening is a new buzz. */
    it("buzzes once while open, and again each time it opens", () => {
      const sheet = (
        isVisible: boolean,
        body = "The payment could not be completed.",
      ) => (
        <ContextForScreen>
          <ErrorMsgBottomSheet
            isVisible={isVisible}
            title="A small problem"
            body={body}
            primaryLabel="Try again"
            onClose={jest.fn()}
            onPrimaryPress={jest.fn()}
          />
        </ContextForScreen>
      )
      const errorBuzzes = () =>
        (ReactNativeHapticFeedback.trigger as jest.Mock).mock.calls.filter(
          ([type]) => type === "notificationError",
        ).length

      const { rerender } = render(sheet(true))
      expect(errorBuzzes()).toBe(1)

      rerender(sheet(true, "Another line for the same opening."))
      expect(errorBuzzes()).toBe(1)

      rerender(sheet(false))
      rerender(sheet(true))
      expect(errorBuzzes()).toBe(2)
    })
  })
})
