import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { TwoFactorManualResetSheet } from "@app/custodial/components/two-factor-manual-reset-sheet"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ModalMock } from "@mocks/react-native-modal-mock"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../../screens/helper"

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

const mockOpenSupport = jest.fn()
jest.mock("@app/hooks/use-contact-support", () => ({
  useContactSupport: () => ({ openSupport: mockOpenSupport }),
}))

loadLocale("en")
const LL = i18nObject("en")

const mockClose = jest.fn()

const renderSheet = async (isVisible = true) => {
  render(
    <ContextForScreen>
      <TwoFactorManualResetSheet isVisible={isVisible} onClose={mockClose} />
    </ContextForScreen>,
  )
  await flushEffects()
}

describe("TwoFactorManualResetSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("says the authenticator is reset by support, not in the app", async () => {
    await renderSheet()

    expect(screen.getByText(LL.TwoFactorTurnOff.manualResetTitle())).toBeTruthy()
    expect(screen.getByText(/we don't allow removal of 2FA inside the app/)).toBeTruthy()
  })

  it("writes to support from the Support link", async () => {
    await renderSheet()

    fireEvent.press(screen.getByText("Support"))

    expect(mockOpenSupport).toHaveBeenCalledTimes(1)
    expect(mockClose).not.toHaveBeenCalled()
  })

  it("closes from Close, the backdrop and the Android back", async () => {
    await renderSheet()

    fireEvent.press(screen.getByText(LL.common.close()))
    fireEvent.press(screen.getByTestId("backdrop"))
    fireEvent.press(screen.getByTestId("back-button"))

    expect(mockClose).toHaveBeenCalledTimes(3)
  })

  it("closes on a swipe down", async () => {
    await renderSheet()

    screen.UNSAFE_getByType(ModalMock).props.onSwipeComplete()

    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it("shows nothing while hidden", async () => {
    await renderSheet(false)

    expect(screen.queryByText(LL.TwoFactorTurnOff.manualResetTitle())).toBeNull()
  })
})
