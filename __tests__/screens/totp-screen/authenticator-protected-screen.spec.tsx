import React from "react"
import { StyleSheet } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { AuthenticatorProtectedScreen } from "@app/screens/totp-screen"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

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
})
