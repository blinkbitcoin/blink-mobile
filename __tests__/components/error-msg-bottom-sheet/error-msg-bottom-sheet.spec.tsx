import React from "react"
import { StyleSheet } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

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
      fireEvent.press(screen.getByLabelText(i18nObject("en").common.close()))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPrimaryPress).not.toHaveBeenCalled()
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
})
