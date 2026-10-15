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

const mockEnforcement = {
  tier: TwoFactorTier.Nudge as TwoFactorTier,
  hasTwoFactor: false,
  missingMethod: TwoFactorMethod.Email as TwoFactorMethod,
  unverifiedEmail: null as string | null,
  shouldShowNudgeCard: true,
  shouldShowSettingsBanner: true,
  dismissNudgeCard: jest.fn(),
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const mockPromptReverification = jest.fn()
jest.mock("@app/hooks/use-email-reverification", () => ({
  useEmailReverification: () => ({
    promptReverification: (...args: unknown[]) => mockPromptReverification(...args),
    spinner: false,
  }),
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

/** The control is rendered on its own: the navigation it needs is the mock above, and
 *  the screen providers would only add async account loads that outlive the test. */
const renderInstalledCloseControl = () => {
  const { headerRight } = mockSetOptions.mock.calls[0][0]
  render(<ThemeProvider theme={theme}>{headerRight({ canGoBack: true })}</ThemeProvider>)
}

describe("TwoFactorSetupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockIsFocused = true
    mockEnforcement.tier = TwoFactorTier.Nudge
    mockEnforcement.hasTwoFactor = false
    mockEnforcement.missingMethod = TwoFactorMethod.Email
    mockEnforcement.unverifiedEmail = null
  })

  it("renders the lock hero with the setup copy", async () => {
    await renderScreen()

    expect(screen.getByTestId("icon-lock-closed")).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.setupTitle())).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.setupDescription())).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator())).toBeTruthy()
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("offers to add an email when that is the missing factor, told to return here", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addEmail()))

    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationInitiate", {
      returnTo: "twoFactorSetup",
    })
    expect(mockPromptReverification).not.toHaveBeenCalled()
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Nudge,
      method: TwoFactorMethod.Email,
    })
  })

  it("sends an address that was never verified through re-verification, told to return here", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    await renderScreen()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addEmail()))

    expect(mockPromptReverification).toHaveBeenCalledWith(
      "someone@example.com",
      "twoFactorSetup",
    )
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Nudge,
      method: TwoFactorMethod.Email,
    })
  })

  it("offers to add a phone number when the email is already verified", async () => {
    mockEnforcement.missingMethod = TwoFactorMethod.Phone
    mockEnforcement.tier = TwoFactorTier.Required
    await renderScreen()

    expect(screen.queryByText(LL.TwoFactorEnforcement.addEmail())).toBeNull()
    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addPhoneNumber()))

    expect(mockNavigate).toHaveBeenCalledWith("phoneRegistrationInitiate")
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Required,
      method: TwoFactorMethod.Phone,
    })
  })

  it("offers the authenticator as the call to action, told to return here", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationInitiate", {
      returnTo: "twoFactorSetup",
    })
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Nudge,
      method: TwoFactorMethod.Authenticator,
    })
  })

  it("makes the authenticator the primary button and the missing factor the secondary one", async () => {
    await renderScreen()

    // eslint-disable-next-line camelcase
    const primary = screen.UNSAFE_getByType(GaloyPrimaryButton)
    // eslint-disable-next-line camelcase
    const secondary = screen.UNSAFE_getByType(GaloySecondaryButton)

    expect(primary.props.title).toBe(LL.TwoFactorEnforcement.setAuthenticator())
    expect(secondary.props.title).toBe(LL.TwoFactorEnforcement.addEmail())
  })

  it("keeps the authenticator primary when the phone number is the missing factor", async () => {
    mockEnforcement.missingMethod = TwoFactorMethod.Phone
    await renderScreen()

    // eslint-disable-next-line camelcase
    const primary = screen.UNSAFE_getByType(GaloyPrimaryButton)
    // eslint-disable-next-line camelcase
    const secondary = screen.UNSAFE_getByType(GaloySecondaryButton)

    expect(primary.props.title).toBe(LL.TwoFactorEnforcement.setAuthenticator())
    expect(secondary.props.title).toBe(LL.TwoFactorEnforcement.addPhoneNumber())
  })

  it("installs a close control that leaves the screen", async () => {
    await renderScreen()

    renderInstalledCloseControl()
    fireEvent.press(screen.getByTestId("icon-close"))

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("steps aside once the account holds two factors", async () => {
    const rendered = await renderScreen()

    mockEnforcement.hasTwoFactor = true
    rendered.rerender(
      <ContextForScreen>
        <TwoFactorSetupScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("stays put while another screen is on top, even with two factors", async () => {
    mockIsFocused = false
    mockEnforcement.hasTwoFactor = true

    await renderScreen()

    expect(mockGoBack).not.toHaveBeenCalled()
  })
})
