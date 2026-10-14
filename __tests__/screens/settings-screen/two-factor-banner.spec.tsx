import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TwoFactorBanner } from "@app/screens/settings-screen/two-factor-banner"
import { TwoFactorTier } from "@app/types/two-factor-enforcement"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockLogTwoFactorPromptShown = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorPromptShown: (...args: unknown[]) => mockLogTwoFactorPromptShown(...args),
}))

const renderBanner = async (tier: TwoFactorTier) => {
  render(
    <ContextForScreen>
      <TwoFactorBanner tier={tier} />
    </ContextForScreen>,
  )
  await flushEffects()
}

describe("TwoFactorBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
  })

  it("renders the title and the settings copy", async () => {
    await renderBanner(TwoFactorTier.Nudge)

    expect(screen.getByText(LL.TwoFactorEnforcement.title())).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.settingsDescription())).toBeTruthy()
  })

  it("logs the banner as shown for its tier", async () => {
    await renderBanner(TwoFactorTier.Required)

    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(1)
    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledWith({
      tier: TwoFactorTier.Required,
      prompt: "settings_banner",
    })
  })

  it("opens the setup screen when pressed", async () => {
    await renderBanner(TwoFactorTier.Nudge)

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.title()))

    expect(mockNavigate).toHaveBeenCalledWith("twoFactorSetup")
  })
})
