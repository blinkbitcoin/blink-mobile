import React from "react"

import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { SparkViewBackupPhraseScreen } from "@app/screens/spark-onboarding/manual-backup/view-backup-phrase-screen"

import { ContextForScreen } from "../helper"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ sparkCompatibleWalletsUrl: "https://spark.example" }),
}))

jest.mock("@app/hooks/use-wallet-mnemonic", () => ({
  useWalletMnemonicWords: () =>
    "youth indicate void nation bundle execute ritual artwork harvest genuine plunge captain".split(
      " ",
    ),
}))

const mockOpenExternalUrl = jest.fn()
jest.mock("@app/utils/external", () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

loadLocale("en")
const LL = i18nObject("en")

describe("SparkViewBackupPhraseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders all 12 words once the mnemonic loads", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(getByText("captain")).toBeTruthy()
    expect(getByText("execute")).toBeTruthy()
    expect(getByText("genuine")).toBeTruthy()
  })

  it("shows the Copy button and the spark-compatible wallet link", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(getByText(LL.BackupScreen.ManualBackup.Phrase.copy())).toBeTruthy()
    expect(
      getByText(LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()),
    ).toBeTruthy()
  })

  it("copies the full mnemonic to the clipboard", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Phrase.copy()))

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
        <SparkViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()))

    expect(mockOpenExternalUrl).toHaveBeenCalledWith("https://spark.example")
  })

  it("renders the Test your backup CTA", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(getByText(LL.BackupScreen.ManualBackup.Phrase.testBackup())).toBeTruthy()
  })

  it("navigates to confirm with challenges and the dynamic success message", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    fireEvent.press(getByText(LL.BackupScreen.ManualBackup.Phrase.testBackup()))

    expect(mockNavigate).toHaveBeenCalledWith(
      "sparkBackupConfirmScreen",
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
