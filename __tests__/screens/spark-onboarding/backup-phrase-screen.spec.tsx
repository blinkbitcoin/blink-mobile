import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { SparkBackupPhraseScreen } from "@app/screens/spark-onboarding/manual-backup/backup-phrase-screen"
import { ContextForScreen } from "../helper"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockCopyToClipboard = jest.fn()
let mockCountdown = { remainingSeconds: 0, isExpired: true }
jest.mock("@app/hooks", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
  useCountdown: () => mockCountdown,
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    sparkCompatibleWalletsUrl: "https://example.com",
  }),
}))

jest.mock("react-native-inappbrowser-reborn", () => ({
  open: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@app/screens/settings-screen/group", () => {
  const { View } = jest.requireActual("react-native")
  return {
    SettingsGroup: ({ items }: { items: (() => React.ReactNode)[] }) => (
      <View>
        {items.map((Item, idx) => (
          <View key={idx}>{Item()}</View>
        ))}
      </View>
    ),
  }
})

loadLocale("en")
const LL = i18nObject("en")

describe("SparkBackupPhraseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCountdown = { remainingSeconds: 0, isExpired: true }
  })

  it("renders seed words", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupPhraseScreen />
      </ContextForScreen>,
    )

    expect(getByText("youth")).toBeTruthy()
    expect(getByText("captain")).toBeTruthy()
  })

  it("renders copy button", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupPhraseScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.SparkOnboarding.ManualBackup.Phrase.copy())).toBeTruthy()
  })

  it("renders save button with saved confirm text when timer expired", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupPhraseScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.SparkOnboarding.ManualBackup.Phrase.savedConfirm())).toBeTruthy()
  })

  it("navigates to confirm screen on save button press", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupPhraseScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Phrase.savedConfirm()))
    expect(mockNavigate).toHaveBeenCalledWith(
      "sparkBackupConfirmScreen",
      expect.objectContaining({
        challenges: expect.arrayContaining([
          expect.objectContaining({
            index: expect.any(Number),
            word: expect.any(String),
          }),
        ]),
      }),
    )
  })

  it("renders spark compatible link", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupPhraseScreen />
      </ContextForScreen>,
    )

    expect(
      getByText(LL.SparkOnboarding.ManualBackup.Phrase.sparkCompatibleLink()),
    ).toBeTruthy()
  })

  it("calls copyToClipboard when copy button is pressed", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupPhraseScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Phrase.copy()))
    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("youth"),
        message: LL.SparkOnboarding.ManualBackup.Phrase.copiedToast(),
      }),
    )
  })

  it("shows countdown in button when timer is active", () => {
    mockCountdown = { remainingSeconds: 5, isExpired: false }

    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupPhraseScreen />
      </ContextForScreen>,
    )

    expect(
      getByText(new RegExp(LL.SparkOnboarding.ManualBackup.Phrase.saveItNow())),
    ).toBeTruthy()
  })

  it("disables save button during countdown", () => {
    mockCountdown = { remainingSeconds: 5, isExpired: false }

    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupPhraseScreen />
      </ContextForScreen>,
    )

    const button = getByText(
      new RegExp(LL.SparkOnboarding.ManualBackup.Phrase.saveItNow()),
    )
    fireEvent.press(button)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("opens spark compatible wallets link", () => {
    const InAppBrowser = jest.requireMock("react-native-inappbrowser-reborn")

    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupPhraseScreen />
      </ContextForScreen>,
    )

    fireEvent.press(
      getByText(LL.SparkOnboarding.ManualBackup.Phrase.sparkCompatibleLink()),
    )
    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com")
  })
})
