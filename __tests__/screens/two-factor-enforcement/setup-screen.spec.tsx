import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TwoFactorSetupScreen } from "@app/screens/two-factor-enforcement"
import {
  TwoFactorMethod,
  TwoFactorPrompt,
  TwoFactorPromptOrigin,
  TwoFactorReminderReason,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
let mockIsFocused = true
let mockRouteParams: TwoFactorPromptOrigin | undefined

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useIsFocused: () => mockIsFocused,
  useRoute: () => ({ params: mockRouteParams }),
}))

let mockIsSelfCustodialDisabled = false
jest.mock("@app/screens/account-migration/hooks/use-self-custodial-disabled", () => ({
  useSelfCustodialDisabled: () => mockIsSelfCustodialDisabled,
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

const BANNER_ORIGIN: TwoFactorPromptOrigin = { prompt: TwoFactorPrompt.SettingsBanner }
const BULLETIN_ORIGIN: TwoFactorPromptOrigin = {
  prompt: TwoFactorPrompt.ReminderBulletin,
  reason: TwoFactorReminderReason.NewAllTimeHigh,
}

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

describe("TwoFactorSetupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockIsFocused = true
    mockRouteParams = BANNER_ORIGIN
    mockIsSelfCustodialDisabled = false
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

  /** With the self-custodial stack switched off there is nothing to move toward. */
  it("offers the authenticator alone while the self-custodial stack is switched off", async () => {
    mockIsSelfCustodialDisabled = true
    await renderScreen()

    expect(primaryButton().props.title).toBe(LL.TwoFactorEnforcement.setAuthenticator())
    expect(screen.queryByText(LL.AccountMigration.moveToNonCustodial())).toBeNull()
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

    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Reminder,
      BANNER_ORIGIN,
    )
  })

  /** Drawn in the screen, on the same margin as every other two-factor screen, rather
   *  than by the native header. */
  it("draws a close control that charges the exit to the tier it opened for", async () => {
    mockEnforcement.unmetTier = TwoFactorTier.Reminder
    await renderScreen()

    fireEvent.press(screen.getByTestId("two-factor-setup-close"))

    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Reminder,
      BANNER_ORIGIN,
    )
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("treats the hardware back as the close control", async () => {
    mockEnforcement.unmetTier = TwoFactorTier.Reminder
    await renderScreen()

    pressHardwareBack()

    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Reminder,
      BANNER_ORIGIN,
    )
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  /** Leaving the setup unfinished is the dismissal of the prompt that opened it, which
   *  the enforcement reports once it counts it. */
  it("charges an exit to the prompt that opened it, with the reason it was up", async () => {
    mockEnforcement.unmetTier = TwoFactorTier.Reminder
    mockRouteParams = BULLETIN_ORIGIN
    await renderScreen()

    pressHardwareBack()

    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Reminder,
      BULLETIN_ORIGIN,
    )
  })

  /** The authenticator flow's return to this route replaces its params. */
  it("keeps the prompt that opened it once its params are replaced", async () => {
    mockEnforcement.unmetTier = TwoFactorTier.Reminder
    mockRouteParams = BULLETIN_ORIGIN
    const rendered = await renderScreen()

    mockRouteParams = undefined
    await rerenderScreen(rendered)
    pressHardwareBack()

    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Reminder,
      BULLETIN_ORIGIN,
    )
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
