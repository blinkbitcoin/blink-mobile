import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { TwoFactorTurnOffModal } from "@app/custodial/components/two-factor-turn-off-modal"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../../screens/helper"

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

loadLocale("en")
const LL = i18nObject("en")

const mockKeepProtected = jest.fn()
const mockContinue = jest.fn()
const mockHidden = jest.fn()

const renderModal = async (isVisible = true) => {
  render(
    <ContextForScreen>
      <TwoFactorTurnOffModal
        isVisible={isVisible}
        onKeepProtected={mockKeepProtected}
        onContinue={mockContinue}
        onHidden={mockHidden}
      />
    </ContextForScreen>,
  )
  await flushEffects()
}

describe("TwoFactorTurnOffModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("recommends keeping the authenticator, and says why", async () => {
    await renderModal()

    expect(screen.getByText(LL.TwoFactorTurnOff.modalTitle())).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorTurnOff.modalBody())).toBeTruthy()
  })

  it("keeps it from Keep me protected", async () => {
    await renderModal()

    fireEvent.press(screen.getByText(LL.TwoFactorTurnOff.keepProtected()))

    expect(mockKeepProtected).toHaveBeenCalledTimes(1)
    expect(mockContinue).not.toHaveBeenCalled()
  })

  it("keeps it from the backdrop and the Android back", async () => {
    await renderModal()

    fireEvent.press(screen.getByTestId("backdrop"))
    fireEvent.press(screen.getByTestId("back-button"))

    expect(mockKeepProtected).toHaveBeenCalledTimes(2)
  })

  it("goes on to the code from Continue", async () => {
    await renderModal()

    fireEvent.press(screen.getByText(LL.common.continue()))

    expect(mockContinue).toHaveBeenCalledTimes(1)
    expect(mockKeepProtected).not.toHaveBeenCalled()
  })

  it("says once it is off the screen", async () => {
    await renderModal()
    expect(mockHidden).not.toHaveBeenCalled()

    screen.rerender(
      <ContextForScreen>
        <TwoFactorTurnOffModal
          isVisible={false}
          onKeepProtected={mockKeepProtected}
          onContinue={mockContinue}
          onHidden={mockHidden}
        />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(mockHidden).toHaveBeenCalledTimes(1)
  })

  it("shows nothing while hidden", async () => {
    await renderModal(false)

    expect(screen.queryByText(LL.TwoFactorTurnOff.modalTitle())).toBeNull()
  })
})
