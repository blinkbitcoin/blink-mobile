import React from "react"
import { Linking } from "react-native"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationApiServiceScreen } from "@app/screens/account-migration/to-non-custodial/api-service-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ feedbackEmailAddress: "feedback@blink.sv" }),
}))

const mockOnContinue = jest.fn()

const renderScreen = () =>
  render(
    <ContextForScreen>
      <MigrationApiServiceScreen onContinue={mockOnContinue} />
    </ContextForScreen>,
  )

describe("MigrationApiServiceScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve())
  })

  it("renders the key hero, title, body and both actions", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("icon-key-outline")).toBeTruthy()
    expect(screen.getByText(LL.AccountMigration.apiServiceTitle())).toBeTruthy()
    expect(screen.getByText(LL.AccountMigration.apiServiceBody())).toBeTruthy()
    expect(screen.getByText(LL.AccountMigration.apiServiceContactCta())).toBeTruthy()
    expect(screen.getByText(LL.AccountMigration.apiServiceContinueCta())).toBeTruthy()
  })

  it("opens the support email when Contact us is pressed", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AccountMigration.apiServiceContactCta()))

    expect(Linking.openURL).toHaveBeenCalledWith("mailto:feedback@blink.sv")
  })

  it("acknowledges the warning when Continue anyways is pressed", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(LL.AccountMigration.apiServiceContinueCta()))

    expect(mockOnContinue).toHaveBeenCalled()
  })
})
