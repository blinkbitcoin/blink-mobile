import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TwoFactorNonCustodialScreen } from "@app/screens/two-factor-enforcement"
import { TwoFactorTier } from "@app/types/two-factor-enforcement"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}))

const mockUseHardwareBackGuard = jest.fn()
jest.mock("@app/screens/account-migration/hooks/use-hardware-back-guard", () => ({
  useHardwareBackGuard: (onBack?: () => void) => mockUseHardwareBackGuard(onBack),
}))

const mockRegisterDismissal = jest.fn()
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => ({
    unmetTier: 2,
    registerDismissal: mockRegisterDismissal,
  }),
}))

const mockLogTwoFactorPromptShown = jest.fn()
const mockLogTwoFactorNonCustodialChosen = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorPromptShown: (...args: unknown[]) => mockLogTwoFactorPromptShown(...args),
  logTwoFactorNonCustodialChosen: (...args: unknown[]) =>
    mockLogTwoFactorNonCustodialChosen(...args),
}))

const renderScreen = async () => {
  render(
    <ContextForScreen>
      <TwoFactorNonCustodialScreen />
    </ContextForScreen>,
  )
  await flushEffects()
}

describe("TwoFactorNonCustodialScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
  })

  it("renders the key hero with the non-custodial copy and logs it as shown once", async () => {
    await renderScreen()

    expect(screen.getByTestId("icon-key-outline")).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.nonCustodialTitle())).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.nonCustodialBody())).toBeTruthy()
    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(1)
    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledWith({
      tier: TwoFactorTier.Recommended,
      prompt: "non_custodial_screen",
    })
  })

  it("opens the standard migration from Move to non-custodial and logs the choice", async () => {
    await renderScreen()

    fireEvent.press(screen.getByTestId("two-factor-non-custodial-move"))

    expect(mockLogTwoFactorNonCustodialChosen).toHaveBeenCalledWith({
      tier: TwoFactorTier.Recommended,
    })
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationEntry")
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  it("charges Cancel to the tier it opened for and goes back", async () => {
    await renderScreen()

    fireEvent.press(screen.getByTestId("two-factor-non-custodial-cancel"))

    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Recommended)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("treats the X the same as Cancel", async () => {
    await renderScreen()

    fireEvent.press(screen.getByTestId("two-factor-non-custodial-close"))

    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Recommended)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("treats the hardware back the same as Cancel", async () => {
    await renderScreen()

    const onBack = mockUseHardwareBackGuard.mock.calls.at(-1)?.[0]
    onBack()

    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Recommended)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })
})
