import React from "react"
import { StyleSheet } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { AuthenticatorProtectedScreen } from "@app/screens/totp-screen"
import { ContactChangeStep, ContactField } from "@app/types/two-factor-enforcement"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
let mockRouteParams: { contactChange?: ContactField } | undefined
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams }),
}))

const mockLeave = jest.fn()
jest.mock("@app/screens/totp-screen/hooks/use-totp-registration-flow", () => ({
  useTotpRegistrationFlow: () => ({ showBackup: jest.fn(), leave: mockLeave }),
}))

const renderScreen = async () => {
  render(
    <ContextForScreen>
      <AuthenticatorProtectedScreen />
    </ContextForScreen>,
  )
  await flushEffects()
}

describe("AuthenticatorProtectedScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockRouteParams = undefined
  })

  it("says the account is protected and what logging in needs from now on", async () => {
    await renderScreen()

    expect(screen.getByText(LL.AuthenticatorOnboarding.protectedTitle())).toBeTruthy()
    expect(
      screen.getByText(LL.AuthenticatorOnboarding.protectedDescription()),
    ).toBeTruthy()
  })

  it("reminds to move the authenticator before resetting the old phone, with before in bold", async () => {
    await renderScreen()

    const before = screen.getByText("before")
    expect(StyleSheet.flatten(before.props.style)).toMatchObject({ fontWeight: "700" })
    expect(
      screen.getByText(/If you get a new phone, move your authenticator to it/),
    ).toBeTruthy()
  })

  it("closes the whole registration from Done", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.AuthenticatorOnboarding.done()))

    expect(mockLeave).toHaveBeenCalledTimes(1)
  })

  it("goes nowhere else from Done when opened from anywhere but a change", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.AuthenticatorOnboarding.done()))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("goes on from Done to the login method change it was added for", async () => {
    mockRouteParams = { contactChange: ContactField.Email }
    await renderScreen()

    fireEvent.press(screen.getByText(LL.AuthenticatorOnboarding.done()))

    expect(mockLeave).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("contactChangeCode", {
      step: ContactChangeStep.EmailRemove,
    })
  })
})
