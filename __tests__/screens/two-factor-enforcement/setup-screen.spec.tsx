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

/** The handler the screen last gave the hardware back, which follows its hold. */
const pressHardwareBack = () => {
  const onBack = mockUseHardwareBackGuard.mock.calls.at(-1)?.[0]
  onBack()
}

const mockRegisterDismissal = jest.fn()
const mockEnforcement = {
  unmetTier: TwoFactorTier.Suggested as TwoFactorTier,
  hasTwoFactor: false,
  missingMethod: TwoFactorMethod.Email as TwoFactorMethod,
  unverifiedEmail: null as string | null,
  markPromptShown: jest.fn(),
  dismissNudgeCard: jest.fn(),
  registerDismissal: mockRegisterDismissal,
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const mockPromptReverification = jest.fn()
const mockUseEmailReverification = jest.fn((_options?: { returnTo?: string }) => ({
  promptReverification: (...args: unknown[]) => mockPromptReverification(...args),
  spinner: mockIsReverifying,
  isAskedHere: mockIsReverifying && mockIsAskedHere,
}))
let mockIsReverifying = false
/** A re-verification in flight was asked for from this screen, unless a test says it
 *  was joined from elsewhere. */
let mockIsAskedHere = true
jest.mock("@app/hooks/use-email-reverification", () => ({
  useEmailReverification: (options?: { returnTo?: string }) =>
    mockUseEmailReverification(options),
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
    mockIsReverifying = false
    mockIsAskedHere = true
    mockEnforcement.unmetTier = TwoFactorTier.Suggested
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
      tier: TwoFactorTier.Suggested,
      method: TwoFactorMethod.Email,
    })
  })

  it("sends an address that was never verified through re-verification", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    await renderScreen()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addEmail()))

    expect(mockPromptReverification).toHaveBeenCalledWith("someone@example.com")
    expect(mockUseEmailReverification).toHaveBeenLastCalledWith({
      returnTo: "twoFactorSetup",
    })
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Suggested,
      method: TwoFactorMethod.Email,
    })
  })

  it("holds every exit while a re-verification is in flight", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    mockEnforcement.unmetTier = TwoFactorTier.Recommended
    mockIsReverifying = true
    await renderScreen()

    /** The missing-factor button shows its spinner in place of its title while it is
     *  held, so there is no label to press; its disabled state is what keeps a second
     *  re-verification from starting. */
    // eslint-disable-next-line camelcase
    const secondary = screen.UNSAFE_getByType(GaloySecondaryButton)
    expect(secondary.props.loading).toBe(true)
    expect(secondary.props.disabled).toBe(true)

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))
    pressHardwareBack()
    renderInstalledCloseControl()
    fireEvent.press(screen.getByTestId("icon-close"))

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("shows the spinner but holds nothing for a re-verification joined from elsewhere", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    mockEnforcement.unmetTier = TwoFactorTier.Recommended
    mockIsReverifying = true
    mockIsAskedHere = false
    await renderScreen()

    // eslint-disable-next-line camelcase
    const secondary = screen.UNSAFE_getByType(GaloySecondaryButton)
    expect(secondary.props.loading).toBe(true)
    pressHardwareBack()

    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Recommended)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  /** The hook ends the sequence for its screens at its own deadline, so this is also
   *  how the hold lifts for a request that never answers. */
  it("releases the hold once the hook ends the re-verification, and holds again for a new run", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    mockEnforcement.unmetTier = TwoFactorTier.Recommended
    mockIsReverifying = true
    const rendered = await renderScreen()
    pressHardwareBack()
    expect(mockGoBack).not.toHaveBeenCalled()

    mockIsReverifying = false
    await rerenderScreen(rendered)
    pressHardwareBack()

    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Recommended)
    expect(mockGoBack).toHaveBeenCalledTimes(1)

    mockIsReverifying = true
    await rerenderScreen(rendered)
    pressHardwareBack()

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("greys the close control out while it holds, so the refusal shows", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    mockIsReverifying = true
    await renderScreen()

    renderInstalledCloseControl()
    fireEvent.press(screen.getByTestId("icon-close"))

    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("steps aside for a complete account only once the hold has lifted", async () => {
    mockEnforcement.hasTwoFactor = true
    mockIsReverifying = true
    const rendered = await renderScreen()

    expect(mockGoBack).not.toHaveBeenCalled()

    mockIsReverifying = false
    await rerenderScreen(rendered)

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("offers to add a phone number when the email is already verified", async () => {
    mockEnforcement.missingMethod = TwoFactorMethod.Phone
    mockEnforcement.unmetTier = TwoFactorTier.Recommended
    await renderScreen()

    expect(screen.queryByText(LL.TwoFactorEnforcement.addEmail())).toBeNull()
    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addPhoneNumber()))

    expect(mockNavigate).toHaveBeenCalledWith("phoneRegistrationInitiate")
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Recommended,
      method: TwoFactorMethod.Phone,
    })
  })

  it("offers the authenticator as the call to action", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationInitiate", {
      returnTo: "twoFactorSetup",
    })
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Suggested,
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

  it("steps aside once the account holds two factors", async () => {
    const rendered = await renderScreen()

    mockEnforcement.hasTwoFactor = true
    await rerenderScreen(rendered)

    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  it("stays put while another screen is on top, even with two factors", async () => {
    mockIsFocused = false
    mockEnforcement.hasTwoFactor = true

    await renderScreen()

    expect(mockGoBack).not.toHaveBeenCalled()
  })
})
