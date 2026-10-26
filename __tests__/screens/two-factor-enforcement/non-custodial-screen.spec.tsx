import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TwoFactorNonCustodialScreen } from "@app/screens/two-factor-enforcement"
import {
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
let mockIsFocused = true
let mockRouteParams:
  | { origin?: TwoFactorPromptOrigin; isOpenedFromSetupScreen?: boolean }
  | undefined

const MODAL_ORIGIN: TwoFactorPromptOrigin = { prompt: TwoFactorPrompt.SessionModal }

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
  useIsFocused: () => mockIsFocused,
}))

const mockUseHardwareBackGuard = jest.fn()
jest.mock("@app/screens/account-migration/hooks/use-hardware-back-guard", () => ({
  useHardwareBackGuard: (onBack?: () => void) => mockUseHardwareBackGuard(onBack),
}))

const mockRegisterDismissal = jest.fn()
let mockIsCustodyExitOffered = true
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => ({
    unmetTier: 3,
    isCustodyExitOffered: mockIsCustodyExitOffered,
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
    mockRouteParams = { origin: MODAL_ORIGIN }
    mockIsCustodyExitOffered = true
    mockIsFocused = true
  })

  it("renders the key hero with the non-custodial copy and logs it as shown once", async () => {
    await renderScreen()

    expect(screen.getByTestId("icon-key-outline")).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.nonCustodialTitle())).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.nonCustodialBody())).toBeTruthy()
    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(1)
    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledWith({
      tier: TwoFactorTier.Enforced,
      prompt: "non_custodial_screen",
    })
  })

  it("opens the standard migration from Move to non-custodial and logs the choice", async () => {
    await renderScreen()

    fireEvent.press(screen.getByTestId("two-factor-non-custodial-move"))

    expect(mockLogTwoFactorNonCustodialChosen).toHaveBeenCalledWith({
      tier: TwoFactorTier.Enforced,
    })
    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationEntry")
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  it("charges Cancel to the tier it opened for, as the dismissal of the prompt that opened it, and goes back", async () => {
    await renderScreen()

    fireEvent.press(screen.getByTestId("two-factor-non-custodial-cancel"))

    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Enforced,
      MODAL_ORIGIN,
    )
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("treats the X the same as Cancel", async () => {
    await renderScreen()

    fireEvent.press(screen.getByTestId("two-factor-non-custodial-close"))

    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Enforced,
      MODAL_ORIGIN,
    )
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("treats the hardware back the same as Cancel", async () => {
    await renderScreen()

    const onBack = mockUseHardwareBackGuard.mock.calls.at(-1)?.[0]
    onBack()

    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Enforced,
      MODAL_ORIGIN,
    )
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  /** The setup is still up under it, and leaving the setup is what counts. */
  it("only returns to the setup it was opened from, charging nothing", async () => {
    mockRouteParams = { isOpenedFromSetupScreen: true }
    await renderScreen()

    fireEvent.press(screen.getByTestId("two-factor-non-custodial-cancel"))
    const onBack = mockUseHardwareBackGuard.mock.calls.at(-1)?.[0]
    onBack()

    expect(mockRegisterDismissal).not.toHaveBeenCalled()
    expect(mockGoBack).toHaveBeenCalledTimes(2)
  })

  /** Every way here is hidden while leaving custody is off; a navigation already on its
   *  way steps aside, and the user declined nothing. */
  it("steps aside at once, charging nothing, while leaving custody is not on offer", async () => {
    mockIsCustodyExitOffered = false
    await renderScreen()

    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockLogTwoFactorPromptShown).not.toHaveBeenCalled()
  })

  /** Under the migration it led to, going back would close that flow. */
  it("stays put while another screen is on top, even with leaving custody off", async () => {
    mockIsCustodyExitOffered = false
    mockIsFocused = false
    await renderScreen()

    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("stays while leaving custody is on offer", async () => {
    await renderScreen()

    expect(mockGoBack).not.toHaveBeenCalled()
  })
})
