import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"
import { TwoFactorSetupScreen } from "@app/screens/two-factor-enforcement"
import { TwoFactorMethod, TwoFactorTier } from "@app/types/two-factor-enforcement"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockSetOptions = jest.fn()
let mockIsFocused = true

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: mockSetOptions,
  }),
  useIsFocused: () => mockIsFocused,
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
  unmetTier: TwoFactorTier.Suggested as TwoFactorTier,
  hasAuthenticator: false,
  markPromptShown: jest.fn(),
  dismissNudgeCard: jest.fn(),
  registerDismissal: mockRegisterDismissal,
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const mockLogTwoFactorSetupStarted = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorSetupStarted: (...args: unknown[]) => mockLogTwoFactorSetupStarted(...args),
}))

const renderScreen = async () => {
  const rendered = render(
    <ContextForScreen>
      <TwoFactorSetupScreen />
    </ContextForScreen>,
  )
  await flushEffects()
  return rendered
}

const rerenderScreen = async (rendered: ReturnType<typeof render>) => {
  rendered.rerender(
    <ContextForScreen>
      <TwoFactorSetupScreen />
    </ContextForScreen>,
  )
  await flushEffects()
}

/** The control as the navigator shows it now, rendered on its own: the navigation it
 *  needs is the mock above, and the screen providers would only add async account
 *  loads that outlive the test. */
const renderInstalledCloseControl = () => {
  const latestOptions = mockSetOptions.mock.calls.at(-1)?.[0] ?? {}
  const { headerRight } = latestOptions
  render(<ThemeProvider theme={theme}>{headerRight({ canGoBack: true })}</ThemeProvider>)
}

describe("TwoFactorSetupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockIsFocused = true
    mockEnforcement.unmetTier = TwoFactorTier.Suggested
    mockEnforcement.hasAuthenticator = false
  })

  it("shows the setup under its header, with the authenticator as the call to action", async () => {
    await renderScreen()

    expect(screen.getByTestId("icon-lock-closed")).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.setupTitle())).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator())).toBeTruthy()
    expect(screen.getByText(LL.AccountMigration.moveToNonCustodial())).toBeTruthy()
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("tells the authenticator flow to return here, under the tier it was opened for", async () => {
    mockEnforcement.unmetTier = TwoFactorTier.Recommended
    await renderScreen()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationInitiate", {
      returnTo: "twoFactorSetup",
    })
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Recommended,
      method: TwoFactorMethod.Authenticator,
    })
  })

  it("keeps reporting the tier it was opened for once the balance moves", async () => {
    mockEnforcement.unmetTier = TwoFactorTier.Recommended
    const rendered = await renderScreen()

    mockEnforcement.unmetTier = TwoFactorTier.Enforced
    await rerenderScreen(rendered)
    pressHardwareBack()

    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Recommended)
  })

  it("installs a close control that charges the exit to the tier it opened for", async () => {
    mockEnforcement.unmetTier = TwoFactorTier.Recommended
    await renderScreen()

    renderInstalledCloseControl()
    fireEvent.press(screen.getByTestId("icon-close"))

    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Recommended)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("treats the hardware back as the close control", async () => {
    mockEnforcement.unmetTier = TwoFactorTier.Recommended
    await renderScreen()

    pressHardwareBack()

    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Recommended)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("steps aside once the account holds an authenticator", async () => {
    const rendered = await renderScreen()

    mockEnforcement.hasAuthenticator = true
    await rerenderScreen(rendered)

    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  it("stays put while another screen is on top, even with an authenticator", async () => {
    mockIsFocused = false
    mockEnforcement.hasAuthenticator = true

    await renderScreen()

    expect(mockGoBack).not.toHaveBeenCalled()
  })
})
