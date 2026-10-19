import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { WalletCurrency } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TwoFactorProtectionRequiredScreen } from "@app/screens/two-factor-enforcement"
import { TwoFactorMethod, TwoFactorTier } from "@app/types/two-factor-enforcement"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockUseHardwareBackGuard = jest.fn()
jest.mock("@app/screens/account-migration/hooks/use-hardware-back-guard", () => ({
  useHardwareBackGuard: (onBack?: () => void) => mockUseHardwareBackGuard(onBack),
}))

let mockIsSelfCustodialDisabled = false
jest.mock("@app/screens/account-migration/hooks/use-self-custodial-disabled", () => ({
  useSelfCustodialDisabled: () => mockIsSelfCustodialDisabled,
}))

const mockRegisterDismissal = jest.fn()
const mockEnforcement = {
  unmetTier: TwoFactorTier.HighBalance as TwoFactorTier,
  remainingDismissals: 0,
  highBalanceCurrency: WalletCurrency.Btc as WalletCurrency,
  highBalanceThreshold: 5_000_000,
  registerDismissal: mockRegisterDismissal,
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const mockLogTwoFactorPromptShown = jest.fn()
const mockLogTwoFactorSetupStarted = jest.fn()
const mockLogTwoFactorNonCustodialChosen = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorPromptShown: (...args: unknown[]) => mockLogTwoFactorPromptShown(...args),
  logTwoFactorSetupStarted: (...args: unknown[]) => mockLogTwoFactorSetupStarted(...args),
  logTwoFactorNonCustodialChosen: (...args: unknown[]) =>
    mockLogTwoFactorNonCustodialChosen(...args),
}))

const renderScreen = async () => {
  const rendered = render(
    <ContextForScreen>
      <TwoFactorProtectionRequiredScreen />
    </ContextForScreen>,
  )
  await flushEffects()
  return rendered
}

const rerenderScreen = async (rendered: ReturnType<typeof render>) => {
  rendered.rerender(
    <ContextForScreen>
      <TwoFactorProtectionRequiredScreen />
    </ContextForScreen>,
  )
  await flushEffects()
}

/** The blocking screen is the high-balance tier's alone, once its modal has spent its
 *  dismissals. */
describe("TwoFactorProtectionRequiredScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockEnforcement.unmetTier = TwoFactorTier.HighBalance
    mockEnforcement.remainingDismissals = 0
    mockEnforcement.highBalanceCurrency = WalletCurrency.Btc
    mockEnforcement.highBalanceThreshold = 5_000_000
    mockIsSelfCustodialDisabled = false
  })

  it("names the sats threshold under a warning sign, with no close control", async () => {
    await renderScreen()

    expect(screen.getByTestId("icon-warning")).toBeTruthy()
    expect(screen.queryByTestId("icon-dollar")).toBeNull()
    expect(
      screen.getByText(
        LL.TwoFactorEnforcement.highBalanceTitle({ amount: "5,000,000 SAT" }),
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(LL.TwoFactorEnforcement.protectionRequiredBody()),
    ).toBeTruthy()
    expect(screen.queryByTestId("two-factor-protection-close")).toBeNull()
  })

  it("names the dollar threshold under a dollar sign, sign first and without cents, when only the dollar wallet crossed", async () => {
    mockEnforcement.highBalanceCurrency = WalletCurrency.Usd
    mockEnforcement.highBalanceThreshold = 500_000
    await renderScreen()

    expect(screen.getByTestId("icon-dollar")).toBeTruthy()
    expect(screen.queryByTestId("icon-warning")).toBeNull()
    expect(
      screen.getByText(LL.TwoFactorEnforcement.highBalanceTitle({ amount: "$5,000" })),
    ).toBeTruthy()
  })

  /** The thresholds are configuration: the title quotes the one the account crossed,
   *  which the provider keeps. */
  it("quotes the high-balance threshold the account crossed", async () => {
    mockEnforcement.highBalanceThreshold = 3_000_000
    await renderScreen()

    expect(
      screen.getByText(
        LL.TwoFactorEnforcement.highBalanceTitle({ amount: "3,000,000 SAT" }),
      ),
    ).toBeTruthy()
  })

  it("offers the authenticator first and leaving custody second", async () => {
    await renderScreen()

    // eslint-disable-next-line camelcase
    expect(screen.UNSAFE_getByType(GaloyPrimaryButton).props.title).toBe(
      LL.TwoFactorEnforcement.setAuthenticator(),
    )
    // eslint-disable-next-line camelcase
    expect(screen.UNSAFE_getByType(GaloySecondaryButton).props.title).toBe(
      LL.AccountMigration.moveToNonCustodial(),
    )
  })

  /** A blocking screen swallows the hardware back rather than letting the app go, and
   *  nothing on it is a dismissal. */
  /** With the self-custodial stack switched off there is nothing to move toward, so
   *  the authenticator is the one way forward. */
  it("offers the authenticator alone while the self-custodial stack is switched off", async () => {
    mockIsSelfCustodialDisabled = true
    await renderScreen()

    expect(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator())).toBeTruthy()
    expect(screen.queryByText(LL.AccountMigration.moveToNonCustodial())).toBeNull()
  })

  it("swallows the hardware back and charges no dismissal", async () => {
    await renderScreen()

    expect(mockUseHardwareBackGuard).toHaveBeenLastCalledWith(undefined)
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  it("logs the screen as shown once for the mount, not again on a re-render", async () => {
    const rendered = await renderScreen()

    await rerenderScreen(rendered)

    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(1)
    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledWith({
      tier: TwoFactorTier.HighBalance,
      prompt: "protection_required_screen",
    })
  })

  it("opens the authenticator setup and logs it, returning to the home", async () => {
    await renderScreen()

    fireEvent.press(screen.getByTestId("two-factor-protection-authenticator"))

    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.HighBalance,
      method: TwoFactorMethod.Authenticator,
    })
    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationInitiate", {
      returnTo: "Primary",
    })
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  it("opens the standard migration from Move to non-custodial and logs the choice", async () => {
    await renderScreen()

    fireEvent.press(screen.getByTestId("two-factor-protection-move"))

    expect(mockLogTwoFactorNonCustodialChosen).toHaveBeenCalledWith({
      tier: TwoFactorTier.HighBalance,
    })
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationEntry")
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })
})
