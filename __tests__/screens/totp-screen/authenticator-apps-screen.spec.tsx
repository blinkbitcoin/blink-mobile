import React from "react"
import { Linking, Platform } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { AuthenticatorAppsScreen } from "@app/screens/totp-screen"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockLogAppSelected = jest.fn()
const mockLogEducationCompleted = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logAuthenticatorAppSelected: (...args: unknown[]) => mockLogAppSelected(...args),
  logAuthenticatorEducationCompleted: () => mockLogEducationCompleted(),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const originalPlatformOS = Platform.OS
const setPlatform = (os: typeof Platform.OS) =>
  Object.defineProperty(Platform, "OS", { configurable: true, value: os })

const renderScreen = async () => {
  render(
    <ContextForScreen>
      <AuthenticatorAppsScreen />
    </ContextForScreen>,
  )
  await flushEffects()
}

describe("AuthenticatorAppsScreen", () => {
  const openURL = jest.spyOn(Linking, "openURL")

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    openURL.mockResolvedValue(true)
  })

  afterEach(() => {
    setPlatform(originalPlatformOS)
  })

  it("lists the three recommended apps, each with what sets it apart", async () => {
    await renderScreen()

    expect(screen.getByText(LL.AuthenticatorOnboarding.appsTitle())).toBeTruthy()
    expect(screen.getByText("Google Authenticator")).toBeTruthy()
    expect(screen.getByText("Proton Authenticator")).toBeTruthy()
    expect(screen.getByText("2FAS Auth")).toBeTruthy()
    expect(
      screen.getByText(LL.AuthenticatorOnboarding.protonAuthenticatorDescription()),
    ).toBeTruthy()
    expect(screen.getAllByText(LL.AuthenticatorOnboarding.get())).toHaveLength(3)
    expect(screen.getByText(LL.AuthenticatorOnboarding.storeNote())).toBeTruthy()
  })

  it("opens an app's App Store listing on iOS, reporting which app", async () => {
    setPlatform("ios")
    await renderScreen()

    fireEvent.press(screen.getByTestId("authenticator-app-proton_authenticator"))

    expect(openURL).toHaveBeenCalledWith("https://apps.apple.com/app/id6741758667")
    expect(mockLogAppSelected).toHaveBeenCalledWith({ app: "proton_authenticator" })
  })

  it("opens an app's Google Play listing on Android", async () => {
    setPlatform("android")
    await renderScreen()

    fireEvent.press(screen.getByTestId("authenticator-app-2fas_auth"))

    expect(openURL).toHaveBeenCalledWith(
      "https://play.google.com/store/apps/details?id=com.twofasapp",
    )
    expect(mockLogAppSelected).toHaveBeenCalledWith({ app: "2fas_auth" })
  })

  /** A device without a store, or with the link blocked, is the device's state. */
  it("reports a store that cannot be opened as expected, and stays put", async () => {
    const failure = new Error("no store")
    openURL.mockRejectedValue(failure)
    await renderScreen()

    await act(async () => {
      fireEvent.press(screen.getByTestId("authenticator-app-google_authenticator"))
    })

    expect(mockReportError).toHaveBeenCalledWith(
      "Authenticator app store link",
      failure,
      {
        expected: true,
      },
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("moves on to the setup key from I have an app, reporting the onboarding done", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.AuthenticatorOnboarding.haveAnApp()))

    expect(mockLogEducationCompleted).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationInitiate")
  })

  /** The screen stays under the setup key, so a tap after a back is the same
   *  registration's. */
  it("reports the onboarding done once, however often I have an app is tapped", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.AuthenticatorOnboarding.haveAnApp()))
    fireEvent.press(screen.getByText(LL.AuthenticatorOnboarding.haveAnApp()))

    expect(mockLogEducationCompleted).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledTimes(2)
  })
})
