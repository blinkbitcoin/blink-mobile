import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { ContactChangeNeedsAuthenticatorModal } from "@app/custodial/components/contact-change-needs-authenticator-modal"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ContactField } from "@app/types/two-factor-enforcement"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../../screens/helper"

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

loadLocale("en")
const LL = i18nObject("en")

const mockClose = jest.fn()
const mockSetAuthenticator = jest.fn()
const mockHidden = jest.fn()

const modalOf = (field: ContactField, isVisible: boolean) => (
  <ContextForScreen>
    <ContactChangeNeedsAuthenticatorModal
      field={field}
      isVisible={isVisible}
      onClose={mockClose}
      onSetAuthenticator={mockSetAuthenticator}
      onHidden={mockHidden}
    />
  </ContextForScreen>
)

const renderModal = async (
  field: ContactField = ContactField.Email,
  isVisible = true,
) => {
  render(modalOf(field, isVisible))
  await flushEffects()
}

describe("ContactChangeNeedsAuthenticatorModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("asks for an authenticator before the email changes, and says why", async () => {
    await renderModal(ContactField.Email)

    expect(screen.getByText(LL.ContactChange.needsAuthenticatorEmailTitle())).toBeTruthy()
    expect(screen.getByText(LL.ContactChange.needsAuthenticatorBody())).toBeTruthy()
    expect(screen.getByText(LL.ContactChange.needsAuthenticatorTime())).toBeTruthy()
  })

  it("asks for it before the phone number changes", async () => {
    await renderModal(ContactField.Phone)

    expect(screen.getByText(LL.ContactChange.needsAuthenticatorPhoneTitle())).toBeTruthy()
    expect(screen.queryByText(LL.ContactChange.needsAuthenticatorEmailTitle())).toBeNull()
  })

  it("goes on to the authenticator from its button", async () => {
    await renderModal()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))

    expect(mockSetAuthenticator).toHaveBeenCalledTimes(1)
    expect(mockClose).not.toHaveBeenCalled()
  })

  it("closes from the backdrop and the Android back", async () => {
    await renderModal()

    fireEvent.press(screen.getByTestId("backdrop"))
    fireEvent.press(screen.getByTestId("back-button"))

    expect(mockClose).toHaveBeenCalledTimes(2)
    expect(mockSetAuthenticator).not.toHaveBeenCalled()
  })

  it("says once it is off the screen", async () => {
    await renderModal()
    expect(mockHidden).not.toHaveBeenCalled()

    screen.rerender(modalOf(ContactField.Email, false))
    await flushEffects()

    expect(mockHidden).toHaveBeenCalledTimes(1)
  })

  it("shows nothing while hidden", async () => {
    await renderModal(ContactField.Email, false)

    expect(screen.queryByText(LL.ContactChange.needsAuthenticatorEmailTitle())).toBeNull()
  })
})
