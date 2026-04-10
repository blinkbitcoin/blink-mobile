import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { SparkBackupConfirmScreen } from "@app/screens/spark-onboarding/manual-backup/backup-confirm-screen"
import { ContextForScreen } from "../helper"

jest.mock("react-native-inappbrowser-reborn", () => ({
  __esModule: true,
  default: { open: jest.fn(() => Promise.resolve()) },
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => ({ saveCheckpoint: jest.fn() }),
  MigrationCheckpoint: {
    BackupMethod: "backupMethod",
    CloudBackup: "cloudBackup",
    BackupAlerts: "backupAlerts",
  },
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useHomeAuthedQuery: () => ({
    data: {
      me: {
        defaultAccount: {
          wallets: [{ balance: 1000, walletCurrency: "BTC" }],
        },
      },
    },
  }),
}))

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({
    params: {
      challenges: [
        { index: 0, word: "youth" },
        { index: 4, word: "bundle" },
        { index: 8, word: "harvest" },
      ],
    },
  }),
}))

loadLocale("en")
const LL = i18nObject("en")

describe("SparkBackupConfirmScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("renders subtitle and input fields", () => {
    const { getByText, getByPlaceholderText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.ManualBackup.Confirm.subtitle())).toBeTruthy()
    expect(
      getByPlaceholderText(`${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 1`),
    ).toBeTruthy()
    expect(
      getByPlaceholderText(`${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 5`),
    ).toBeTruthy()
    expect(
      getByPlaceholderText(`${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 9`),
    ).toBeTruthy()
  })

  it("shows enter words label when inputs are empty", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.BackupScreen.ManualBackup.Confirm.enterWords())).toBeTruthy()
  })

  it("shows autocomplete suggestions when typing 3+ characters", () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fireEvent.changeText(
      getByPlaceholderText(`${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 1`),
      "you",
    )

    expect(getByText("young")).toBeTruthy()
    expect(getByText("youth")).toBeTruthy()
  })

  it("fills input when suggestion is selected", () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    const input = getByPlaceholderText(
      `${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 1`,
    )
    fireEvent.changeText(input, "you")
    fireEvent.press(getByText("youth"))

    expect(input.props.value).toBe("youth")
  })

  it("shows word number when input has content", () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fireEvent.changeText(
      getByPlaceholderText(`${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 1`),
      "you",
    )
    fireEvent.press(getByText("youth"))

    expect(getByText("1.")).toBeTruthy()
  })
})
