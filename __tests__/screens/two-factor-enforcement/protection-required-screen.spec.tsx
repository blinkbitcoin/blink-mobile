import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TwoFactorProtectionRequiredScreen } from "@app/screens/two-factor-enforcement"
import {
  TwoFactorMethod,
  TwoFactorSessionPrompt,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
let mockIsFocused = true

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useIsFocused: () => mockIsFocused,
}))

const mockUseHardwareBackGuard = jest.fn()
jest.mock("@app/screens/account-migration/hooks/use-hardware-back-guard", () => ({
  useHardwareBackGuard: (onBack?: () => void) => mockUseHardwareBackGuard(onBack),
}))

const mockRegisterDismissal = jest.fn()
const mockEnforcement = {
  unmetTier: TwoFactorTier.Recommended as TwoFactorTier,
  remainingDismissals: 0,
  requiredPrompt: TwoFactorSessionPrompt.ProtectionRequired as TwoFactorSessionPrompt,
  enforcedCurrency: WalletCurrency.Btc as WalletCurrency,
  registerDismissal: mockRegisterDismissal,
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const mockLogTwoFactorPromptShown = jest.fn()
const mockLogTwoFactorPromptDismissed = jest.fn()
const mockLogTwoFactorSetupStarted = jest.fn()
const mockLogTwoFactorNonCustodialChosen = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorPromptShown: (...args: unknown[]) => mockLogTwoFactorPromptShown(...args),
  logTwoFactorPromptDismissed: (...args: unknown[]) =>
    mockLogTwoFactorPromptDismissed(...args),
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

const atEnforcedTier = (remaining: number) => {
  mockEnforcement.unmetTier = TwoFactorTier.Enforced
  mockEnforcement.remainingDismissals = remaining
}

describe("TwoFactorProtectionRequiredScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockIsFocused = true
    mockEnforcement.unmetTier = TwoFactorTier.Recommended
    mockEnforcement.remainingDismissals = 0
    mockEnforcement.requiredPrompt = TwoFactorSessionPrompt.ProtectionRequired
    mockEnforcement.enforcedCurrency = WalletCurrency.Btc
  })

  describe("at the recommended tier", () => {
    it("blocks: warning hero, no amount in the title, no close control", async () => {
      await renderScreen()

      expect(screen.getByTestId("icon-warning")).toBeTruthy()
      expect(
        screen.getByText(LL.TwoFactorEnforcement.protectionRequiredTitle()),
      ).toBeTruthy()
      expect(
        screen.getByText(LL.TwoFactorEnforcement.protectionRequiredBody()),
      ).toBeTruthy()
      expect(screen.queryByTestId("two-factor-protection-close")).toBeNull()
      expect(mockUseHardwareBackGuard).toHaveBeenLastCalledWith(undefined)
    })

    it("logs the prompt as shown once, for the tier it was raised for", async () => {
      const rendered = await renderScreen()

      mockEnforcement.unmetTier = TwoFactorTier.None
      await rerenderScreen(rendered)

      expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(1)
      expect(mockLogTwoFactorPromptShown).toHaveBeenCalledWith({
        tier: TwoFactorTier.Recommended,
        prompt: "protection_required_screen",
      })
    })
  })

  describe("at the enforced tier", () => {
    it("names the sats threshold with a dollar hero and offers an X while dismissals remain", async () => {
      atEnforcedTier(3)
      await renderScreen()

      expect(screen.getByTestId("icon-dollar")).toBeTruthy()
      expect(
        screen.getByText(
          LL.TwoFactorEnforcement.highBalanceTitle({ amount: "5,000,000 SAT" }),
        ),
      ).toBeTruthy()
      expect(screen.getByTestId("two-factor-protection-close")).toBeTruthy()
      expect(mockUseHardwareBackGuard).toHaveBeenLastCalledWith(expect.any(Function))
    })

    it("names the dollar threshold, sign first and without cents, when only the dollar wallet crossed", async () => {
      atEnforcedTier(3)
      mockEnforcement.enforcedCurrency = WalletCurrency.Usd
      await renderScreen()

      expect(
        screen.getByText(LL.TwoFactorEnforcement.highBalanceTitle({ amount: "$5,000" })),
      ).toBeTruthy()
    })

    it("charges the X to the enforced tier, logs it and goes back", async () => {
      atEnforcedTier(1)
      await renderScreen()

      fireEvent.press(screen.getByTestId("two-factor-protection-close"))

      expect(mockLogTwoFactorPromptDismissed).toHaveBeenCalledWith({
        tier: TwoFactorTier.Enforced,
        prompt: "protection_required_screen",
      })
      expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Enforced)
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("treats the hardware back as the X while dismissals remain", async () => {
      atEnforcedTier(2)
      await renderScreen()

      const onBack = mockUseHardwareBackGuard.mock.calls.at(-1)?.[0]
      onBack()

      expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Enforced)
      expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it("blocks once the dismissals are spent", async () => {
      atEnforcedTier(0)
      await renderScreen()

      expect(screen.queryByTestId("two-factor-protection-close")).toBeNull()
      expect(mockUseHardwareBackGuard).toHaveBeenLastCalledWith(undefined)
    })
  })

  it("opens the authenticator setup and logs it", async () => {
    await renderScreen()

    fireEvent.press(screen.getByTestId("two-factor-protection-authenticator"))

    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Recommended,
      method: TwoFactorMethod.Authenticator,
    })
    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationInitiate")
  })

  it("opens the standard migration from Move to non-custodial and logs the choice", async () => {
    await renderScreen()

    fireEvent.press(screen.getByTestId("two-factor-protection-move"))

    expect(mockLogTwoFactorNonCustodialChosen).toHaveBeenCalledWith({
      tier: TwoFactorTier.Recommended,
    })
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationEntry")
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  it("steps aside once the account no longer needs it", async () => {
    const rendered = await renderScreen()
    expect(mockGoBack).not.toHaveBeenCalled()

    mockEnforcement.requiredPrompt = TwoFactorSessionPrompt.None
    await rerenderScreen(rendered)

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("stays put while another screen is on top, even once no longer needed", async () => {
    mockIsFocused = false
    mockEnforcement.requiredPrompt = TwoFactorSessionPrompt.None

    await renderScreen()

    expect(mockGoBack).not.toHaveBeenCalled()
  })
})
