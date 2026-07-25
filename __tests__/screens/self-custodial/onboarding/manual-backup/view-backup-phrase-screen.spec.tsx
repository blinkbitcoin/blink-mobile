import React from "react"

import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ViewBackupPhraseScreen } from "@app/screens/self-custodial/onboarding/manual-backup/view-backup-phrase-screen"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { ContextForScreen } from "../../../helper"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}))

const mockIsSensorAvailable = jest.fn()
const mockAuthenticate = jest.fn()
jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: {
    isSensorAvailable: (...args: unknown[]) => mockIsSensorAvailable(...args),
    authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  },
}))

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
  let mockGetIsBiometricsEnabled: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    // biometrics disabled by default: the gate passes without prompting
    mockGetIsBiometricsEnabled = jest
      .spyOn(KeyStoreWrapper, "getIsBiometricsEnabled")
      .mockResolvedValue(false)
    mockIsSensorAvailable.mockResolvedValue(true)
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

  it("shows the Copy button and the spark-compatible wallet link", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
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
        <ViewBackupPhraseScreen />
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

  it("does not prompt for biometrics when the setting is disabled", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(mockAuthenticate).not.toHaveBeenCalled()
  })

  it("shows the phrase after successful biometric auth when the setting is enabled", async () => {
    mockGetIsBiometricsEnabled.mockResolvedValue(true)
    mockAuthenticate.mockImplementation((_desc: string, onSuccess: () => void) => {
      onSuccess()
    })

    const { getByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(getByText("youth")).toBeTruthy())
    expect(mockAuthenticate).toHaveBeenCalledWith(
      LL.BackupScreen.ManualBackup.Phrase.authDescription(),
      expect.any(Function),
      expect.any(Function),
    )
  })

  it("goes back without showing the phrase when biometric auth fails", async () => {
    mockGetIsBiometricsEnabled.mockResolvedValue(true)
    mockAuthenticate.mockImplementation(
      (_desc: string, _onSuccess: () => void, onFail: () => void) => {
        onFail()
      },
    )

    const { queryByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1))
    expect(queryByText("youth")).toBeNull()
  })

  it("does not show the phrase while biometric auth is pending", async () => {
    mockGetIsBiometricsEnabled.mockResolvedValue(true)
    mockAuthenticate.mockImplementation(() => {
      // user has not responded to the prompt yet
    })

    const { queryByText } = render(
      <ContextForScreen>
        <ViewBackupPhraseScreen />
      </ContextForScreen>,
    )

    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1))
    expect(queryByText("youth")).toBeNull()
  })
})
