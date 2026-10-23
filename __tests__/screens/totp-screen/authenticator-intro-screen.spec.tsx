import React from "react"
import { StyleSheet } from "react-native"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import {
  DefaultTheme as navigationDefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native"
import { ThemeProvider } from "@rn-vui/themed"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"
import { AuthenticatorIntroScreen } from "@app/screens/totp-screen"
import {
  TwoFactorFlowParams,
  TwoFactorPrompt,
  TwoFactorPromptOrigin,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockSetOptions = jest.fn()
let mockRouteParams: TwoFactorFlowParams | undefined

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: mockSetOptions,
  }),
  useRoute: () => ({ params: mockRouteParams }),
}))

const mockUseHardwareBackGuard = jest.fn()
jest.mock("@app/screens/account-migration/hooks/use-hardware-back-guard", () => ({
  useHardwareBackGuard: (onBack?: () => void) => mockUseHardwareBackGuard(onBack),
}))

/** The handler the screen last gave the hardware back. */
const pressHardwareBack = () => {
  const onBack = mockUseHardwareBackGuard.mock.calls.at(-1)?.[0]
  onBack()
}

const mockRegisterDismissal = jest.fn()
const mockEnforcement = {
  unmetTier: TwoFactorTier.Recommended as TwoFactorTier,
  registerDismissal: mockRegisterDismissal,
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const mockLogTwoFactorSetupStarted = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorSetupStarted: (...args: unknown[]) => mockLogTwoFactorSetupStarted(...args),
}))

const BULLETIN_ORIGIN: TwoFactorPromptOrigin = {
  prompt: TwoFactorPrompt.ReminderBulletin,
}

const renderScreen = async () => {
  render(
    <ContextForScreen>
      <AuthenticatorIntroScreen />
    </ContextForScreen>,
  )
  await flushEffects()
}

/** The back control as the navigator shows it now, rendered on its own. */
const renderInstalledBackControl = () => {
  const { headerLeft } = mockSetOptions.mock.calls.at(-1)?.[0] ?? {}
  render(
    <NavigationThemeProvider value={navigationDefaultTheme}>
      <ThemeProvider theme={theme}>{headerLeft({ canGoBack: true })}</ThemeProvider>
    </NavigationThemeProvider>,
  )
}

describe("AuthenticatorIntroScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockRouteParams = { origin: BULLETIN_ORIGIN }
    mockEnforcement.unmetTier = TwoFactorTier.Recommended
  })

  it("explains what an authenticator is and what it does for the account", async () => {
    await renderScreen()

    expect(screen.getByText(LL.AuthenticatorOnboarding.introTitle())).toBeTruthy()
    expect(screen.getByText(LL.AuthenticatorOnboarding.introDescription())).toBeTruthy()
    expect(screen.getByText(LL.AuthenticatorOnboarding.takeoversTitle())).toBeTruthy()
    expect(
      screen.getByText(LL.AuthenticatorOnboarding.stolenNumberDescription()),
    ).toBeTruthy()
    expect(screen.getByText(LL.AuthenticatorOnboarding.durationTitle())).toBeTruthy()
  })

  /** Nothing in the card is pressed, so it sits on the static card surface rather than
   *  the one tappable rows use. */
  it("draws the benefits on the static card surface", async () => {
    await renderScreen()

    const card = screen.getByTestId("authenticator-intro-benefits")
    expect(StyleSheet.flatten(card.props.style).backgroundColor).toBe(light.grey7)
  })

  /** Every Set authenticator lands here, so this is where the setup starts. */
  it("reports the setup as started, once, under the tier it opened for", async () => {
    await renderScreen()

    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledTimes(1)
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Recommended,
      method: "authenticator",
    })
  })

  it("moves on to the apps from Get started", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.AuthenticatorOnboarding.getStarted()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationApps")
  })

  it("treats the hardware back as the dismissal of the prompt that opened it", async () => {
    await renderScreen()

    pressHardwareBack()

    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Recommended,
      BULLETIN_ORIGIN,
    )
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("installs a back control that leaves the same way", async () => {
    await renderScreen()

    renderInstalledBackControl()
    fireEvent.press(screen.getByLabelText("Go back"))

    await waitFor(() =>
      expect(mockRegisterDismissal).toHaveBeenCalledWith(
        TwoFactorTier.Recommended,
        BULLETIN_ORIGIN,
      ),
    )
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("only goes back, charging nothing, when the setup opened it", async () => {
    mockRouteParams = { isOpenedFromSetupScreen: true }
    await renderScreen()

    pressHardwareBack()

    expect(mockRegisterDismissal).not.toHaveBeenCalled()
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  /** The registration never started, so backing out waves nothing away. */
  it("only goes back, charging nothing, once the registration could not start", async () => {
    mockRouteParams = { origin: BULLETIN_ORIGIN, hasRegistrationFailedToStart: true }
    await renderScreen()

    pressHardwareBack()

    expect(mockRegisterDismissal).not.toHaveBeenCalled()
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })
})
