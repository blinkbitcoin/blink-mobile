import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
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
  unmetTier: TwoFactorTier.Nudge as TwoFactorTier,
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

// eslint-disable-next-line camelcase
const primaryButton = () => screen.UNSAFE_getByType(GaloyPrimaryButton)
// eslint-disable-next-line camelcase
const secondaryButton = () => screen.UNSAFE_getByType(GaloySecondaryButton)

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
    mockEnforcement.unmetTier = TwoFactorTier.Nudge
    mockEnforcement.hasAuthenticator = false
  })

  it("renders the lock hero with the setup copy", async () => {
    await renderScreen()

    expect(screen.getByTestId("icon-lock-closed")).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.setupTitle())).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.setupDescription())).toBeTruthy()
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  /** An email or a phone added to the one the account logs in with protects nothing:
   *  the setup offers the authenticator, or leaving custody, and nothing else. */
  it("offers the authenticator first and leaving custody second, and nothing else", async () => {
    await renderScreen()

    expect(primaryButton().props.title).toBe(LL.TwoFactorEnforcement.setAuthenticator())
    expect(secondaryButton().props.title).toBe(LL.AccountMigration.moveToNonCustodial())
  })

  it("tells the authenticator flow to return here, under the tier it was opened for", async () => {
    mockEnforcement.unmetTier = TwoFactorTier.Reminder
    await renderScreen()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationInitiate", {
      returnTo: "twoFactorSetup",
    })
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Reminder,
      method: TwoFactorMethod.Authenticator,
    })
  })

  /** Leaving custody goes through the screen that explains what it means; that screen
   *  reports the choice, so nothing is reported here. The setup stays under it, which
   *  that screen is told, so backing out of it lands back here with no dismissal. */
  it("opens the screen that explains leaving custody over the setup, reporting nothing itself", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.AccountMigration.moveToNonCustodial()))

    expect(mockNavigate).toHaveBeenCalledWith("twoFactorNonCustodial", {
      isFromSetup: true,
    })
    expect(mockLogTwoFactorSetupStarted).not.toHaveBeenCalled()
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  it("keeps reporting the tier it was opened for once the balance moves", async () => {
    mockEnforcement.unmetTier = TwoFactorTier.Reminder
    const rendered = await renderScreen()

    mockEnforcement.unmetTier = TwoFactorTier.HighBalance
    await rerenderScreen(rendered)
    pressHardwareBack()

    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Reminder)
  })

  it("installs a close control that charges the exit to the tier it opened for", async () => {
    mockEnforcement.unmetTier = TwoFactorTier.Reminder
    await renderScreen()

    renderInstalledCloseControl()
    fireEvent.press(screen.getByTestId("icon-close"))

    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Reminder)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("treats the hardware back as the close control", async () => {
    mockEnforcement.unmetTier = TwoFactorTier.Reminder
    await renderScreen()

    pressHardwareBack()

    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Reminder)
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
