import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { SparkBackupPhraseScreen } from "@app/screens/spark-onboarding/manual-backup/backup-phrase-screen"
import { ContextForScreen } from "../helper"

const mockNavigate = jest.fn()
let mockStep = 1
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { step: mockStep } }),
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
  __esModule: true,
  default: { open: jest.fn(() => Promise.resolve()) },
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
    mockStep = 1
    mockCountdown = { remainingSeconds: 0, isExpired: true }
  })

  describe("step 1", () => {
    it("renders first 6 words", () => {
      const { getByText, queryByText } = render(
        <ContextForScreen>
          <SparkBackupPhraseScreen />
        </ContextForScreen>,
      )

      expect(getByText("youth")).toBeTruthy()
      expect(getByText("execute")).toBeTruthy()
      expect(queryByText("ritual")).toBeNull()
    })

    it("shows Continue button when timer expired", () => {
      const { getByText } = render(
        <ContextForScreen>
          <SparkBackupPhraseScreen />
        </ContextForScreen>,
      )

      expect(
        getByText(LL.SparkOnboarding.ManualBackup.Phrase.continueButton()),
      ).toBeTruthy()
    })

    it("navigates to step 2 on continue press", () => {
      const { getByText } = render(
        <ContextForScreen>
          <SparkBackupPhraseScreen />
        </ContextForScreen>,
      )

      fireEvent.press(getByText(LL.SparkOnboarding.ManualBackup.Phrase.continueButton()))
      expect(mockNavigate).toHaveBeenCalledWith("sparkBackupPhraseScreen", { step: 2 })
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

    it("disables button during countdown", () => {
      mockCountdown = { remainingSeconds: 5, isExpired: false }

      const { getByText } = render(
        <ContextForScreen>
          <SparkBackupPhraseScreen />
        </ContextForScreen>,
      )

      fireEvent.press(
        getByText(new RegExp(LL.SparkOnboarding.ManualBackup.Phrase.saveItNow())),
      )
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe("step 2", () => {
    beforeEach(() => {
      mockStep = 2
    })

    it("renders last 6 words", () => {
      const { getByText, queryByText } = render(
        <ContextForScreen>
          <SparkBackupPhraseScreen />
        </ContextForScreen>,
      )

      expect(getByText("ritual")).toBeTruthy()
      expect(getByText("captain")).toBeTruthy()
      expect(queryByText("youth")).toBeNull()
    })

    it("shows I have saved it button", () => {
      const { getByText } = render(
        <ContextForScreen>
          <SparkBackupPhraseScreen />
        </ContextForScreen>,
      )

      expect(
        getByText(LL.SparkOnboarding.ManualBackup.Phrase.savedConfirm()),
      ).toBeTruthy()
    })

    it("navigates to confirm screen on button press", () => {
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
  })

  describe("shared", () => {
    it("renders copy button", () => {
      const { getByText } = render(
        <ContextForScreen>
          <SparkBackupPhraseScreen />
        </ContextForScreen>,
      )

      expect(getByText(LL.SparkOnboarding.ManualBackup.Phrase.copy())).toBeTruthy()
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
  })
})
