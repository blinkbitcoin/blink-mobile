import React from "react"

import { fireEvent, render, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { OperatorUnreachableScreen } from "@app/screens/self-custodial/onboarding/restore/emergency/operator-unreachable-screen"

import { ContextForScreen } from "../../../../helper"

let LL: TranslationFunctions

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}))

const renderScreen = () =>
  render(
    <ContextForScreen>
      <OperatorUnreachableScreen />
    </ContextForScreen>,
  )

describe("OperatorUnreachableScreen", () => {
  beforeAll(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("names the outage rather than blaming the backup phrase", () => {
    // The generic restore failure tells the user to check their phrase, which
    // is the wrong advice when the operators are the ones that are down.
    renderScreen()

    expect(screen.getByText(LL.EmergencyRecovery.outageTitle())).toBeTruthy()
    expect(screen.queryByText(LL.RestoreScreen.invalidMnemonic())).toBeNull()
  })

  /** The emergency bundle is not offered in the restore flow. */
  it("does not offer emergency recovery", () => {
    renderScreen()

    expect(screen.queryByTestId("outage-emergency-recovery-link")).toBeNull()
  })

  it("goes back to the phrase for another attempt", () => {
    renderScreen()

    fireEvent.press(screen.getByTestId("outage-try-again-button"))
    expect(mockGoBack).toHaveBeenCalled()
  })

  it("leaves the restore flow entirely on close", () => {
    renderScreen()

    fireEvent.press(screen.getByTestId("outage-close-button"))
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialRestoreMethod")
  })

  it("links to support", () => {
    renderScreen()

    fireEvent.press(screen.getByTestId("outage-support-link"))
    expect(mockNavigate).toHaveBeenCalledWith("onboarding", {
      screen: "supportScreen",
    })
  })
})
