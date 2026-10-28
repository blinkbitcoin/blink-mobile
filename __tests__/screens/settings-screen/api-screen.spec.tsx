import React from "react"
import { Linking } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { ApiScreen } from "@app/screens/settings-screen/api-screen"
import { ContextForScreen } from "../helper"

jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve(true))

describe("ApiScreen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
    jest.clearAllMocks()
  })

  /** The screen lists the account's API keys on mount; settling that query inside
   *  the test keeps its state update from landing after the assertions. */
  const renderSettled = async () => {
    render(
      <ContextForScreen>
        <ApiScreen />
      </ContextForScreen>,
    )
    await screen.findByText(LL.ApiScreen.noKeys())
  }

  it("renders API Documentation item", async () => {
    await renderSettled()

    expect(screen.getByText(LL.SettingsScreen.apiDocumentation())).toBeTruthy()
  })

  it("renders API Dashboard item", async () => {
    await renderSettled()

    expect(screen.getByText(LL.SettingsScreen.apiDashboard())).toBeTruthy()
  })

  it("opens dashboard link when pressing API Documentation", async () => {
    await renderSettled()

    const documentationItem = screen.getByText(LL.SettingsScreen.apiDocumentation())
    fireEvent.press(documentationItem)

    expect(Linking.openURL).toHaveBeenCalledWith("https://dashboard.blink.sv")
  })

  it("opens dashboard link when pressing API Dashboard", async () => {
    await renderSettled()

    const dashboardItem = screen.getByText(LL.SettingsScreen.apiDashboard())
    fireEvent.press(dashboardItem)

    expect(Linking.openURL).toHaveBeenCalledWith("https://dashboard.blink.sv")
  })
})
