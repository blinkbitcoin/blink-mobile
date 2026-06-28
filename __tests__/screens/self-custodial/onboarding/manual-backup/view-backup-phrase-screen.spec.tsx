import React from "react"

import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ViewBackupPhraseScreen } from "@app/screens/self-custodial/onboarding/manual-backup/view-backup-phrase-screen"

import { ContextForScreen } from "../../../helper"

const mockNavigate = jest.fn()
const mockSetOptions = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
}))

const renderHeaderRight = () => {
  const calls = mockSetOptions.mock.calls
  const lastOptions = calls[calls.length - 1]?.[0]
  if (!lastOptions?.headerRight) throw new Error("headerRight was not set")
  return render(<ContextForScreen>{lastOptions.headerRight()}</ContextForScreen>)
}

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ sparkCompatibleWalletsUrl: "https://spark.example" }),
}))

jest.mock("@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonic: () =>
    "youth indicate void nation bundle execute ritual artwork harvest genuine plunge captain",
}))

const mockOpenExternalUrl = jest.fn()
jest.mock("@app/utils/external", () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

loadLocale("en")
const LL = i18nObject("en")

describe("ViewBackupPhraseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders all 12 words once the mnemonic loads", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(getByText("captain")).toBeTruthy()
    expect(getByText("execute")).toBeTruthy()
    expect(getByText("genuine")).toBeTruthy()
  })

  it("shows the Copy button in the header and the spark-compatible wallet link", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(
      getByText(LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()),
    ).toBeTruthy()

    const { getByText: getHeaderText } = renderHeaderRight()
    expect(getHeaderText(LL.BackupScreen.ManualBackup.Phrase.copy())).toBeTruthy()
  })

  it("renders the do-not-share warning card", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(
      getByText(LL.BackupScreen.ManualBackup.Phrase.doNotShareWarning()),
    ).toBeTruthy()
  })

  it("copies the full mnemonic to the clipboard", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    const { getByText: getHeaderText } = renderHeaderRight()
    fireEvent.press(getHeaderText(LL.BackupScreen.ManualBackup.Phrase.copy()))

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("captain"),
        message: LL.BackupScreen.ManualBackup.Phrase.copiedToast(),
      }),
    )
  })

  it("opens the spark-compatible link from the info banner", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()))

    expect(mockOpenExternalUrl).toHaveBeenCalledWith("https://spark.example")
  })

  it("renders the Test your backup CTA", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(getByText(LL.BackupScreen.ManualBackup.Phrase.testBackup())).toBeTruthy()
  })

  it("navigates to confirm with challenges and the dynamic success message", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Phrase.testBackup()))

    expect(mockNavigate).toHaveBeenCalledWith(
      "selfCustodialBackupPhraseConfirm",
      expect.objectContaining({
        challenges: expect.arrayContaining([
          expect.objectContaining({
            index: expect.any(Number),
            word: expect.any(String),
          }),
        ]),
        successMessage: LL.BackupScreen.ManualBackup.Success.testSuccess(),
      }),
    )
  })
})
