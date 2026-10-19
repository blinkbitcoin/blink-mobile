import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TwoFactorBanner } from "@app/screens/settings-screen/two-factor-banner"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockMarkPromptShown = jest.fn()
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => ({ markPromptShown: mockMarkPromptShown }),
}))

const renderBanner = async () => {
  render(
    <ContextForScreen>
      <TwoFactorBanner />
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
    await renderBanner()

    expect(screen.getByText(LL.TwoFactorEnforcement.title())).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.settingsDescription())).toBeTruthy()
  })

  it("reports itself as shown to the enforcement, which counts the impressions", async () => {
    await renderBanner()

    expect(mockMarkPromptShown).toHaveBeenCalledTimes(1)
    expect(mockMarkPromptShown).toHaveBeenCalledWith("settings_banner")
  })

  it("opens the setup when pressed, telling it the banner opened it", async () => {
    await renderBanner()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.title()))

    expect(mockNavigate).toHaveBeenCalledWith("twoFactorSetup", {
      prompt: "settings_banner",
    })
  })
})
