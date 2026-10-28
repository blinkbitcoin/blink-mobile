import React from "react"

import { fireEvent, render, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import {
  holdEmergencyPhrase,
  readEmergencyPhrase,
} from "@app/screens/self-custodial/onboarding/restore/emergency/emergency-phrase"
import { OperatorUnreachableScreen } from "@app/screens/self-custodial/onboarding/restore/emergency/operator-unreachable-screen"

import { ContextForScreen } from "../../../../helper"

let LL: TranslationFunctions

const MNEMONIC = "abandon abandon about"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
let mockPhraseHandle = ""

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useRoute: () => ({ params: { phraseHandle: mockPhraseHandle } }),
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
    mockPhraseHandle = holdEmergencyPhrase(MNEMONIC)
  })

  it("names the outage rather than blaming the backup phrase", () => {
    // The generic restore failure tells the user to check their phrase, which
    // is the wrong advice when the operators are the ones that are down.
    renderScreen()

    expect(screen.getByText(LL.EmergencyRecovery.outageTitle())).toBeTruthy()
    expect(screen.queryByText(LL.RestoreScreen.invalidMnemonic())).toBeNull()
  })

  it("offers emergency recovery, which needs no operators", () => {
    renderScreen()

    fireEvent.press(screen.getByTestId("outage-emergency-recovery-link"))
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialEmergencyRecovery", {
      phraseHandle: mockPhraseHandle,
    })
  })

  it("carries the phrase forward by handle so it is not typed twice", () => {
    // Twelve words re-entered at the worst possible moment is its own failure
    // mode; but the navigator keeps route params in its history, so the phrase
    // itself must not ride in them.
    renderScreen()

    fireEvent.press(screen.getByTestId("outage-emergency-recovery-link"))
    const [, params] = mockNavigate.mock.calls[0]
    expect(JSON.stringify(params)).not.toContain("abandon")
    expect(readEmergencyPhrase(params.phraseHandle)).toBe(MNEMONIC)
  })

  it("drops the phrase once it leaves the stack, whichever way out was taken", () => {
    // Trying again, closing, and leaving recovery for another restore method all
    // take this screen off the stack; its unmount is the one exit they share.
    const { unmount } = renderScreen()
    expect(readEmergencyPhrase(mockPhraseHandle)).toBe(MNEMONIC)

    unmount()

    expect(readEmergencyPhrase(mockPhraseHandle)).toBeNull()
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
