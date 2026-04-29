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

const mockCheckpoint = jest.fn<string | null, []>()
const mockCheckpointLoading = jest.fn<boolean, []>()
jest.mock("@app/screens/account-migration/hooks", () => ({
  useMigrationCheckpoint: () => ({
    saveCheckpoint: jest.fn(),
    checkpoint: mockCheckpoint(),
    loading: mockCheckpointLoading(),
  }),
  MigrationCheckpoint: {
    BackupMethod: "backupMethod",
    CloudBackup: "cloudBackup",
    BackupAlerts: "backupAlerts",
  },
}))

const mockBackupStateValue = jest.fn<
  {
    backupState: { status: string; method: string | null }
    setBackupCompleted: jest.Mock
  },
  []
>()
jest.mock("@app/self-custodial/providers/backup-state-provider", () => ({
  BackupStatus: { None: "none", Completed: "completed" },
  useBackupState: () => mockBackupStateValue(),
}))

const mockActiveWalletValue = jest.fn()
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockActiveWalletValue(),
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
const mockRouteParams = jest.fn<
  {
    challenges: Array<{ index: number; word: string }>
    successMessage?: string
  },
  []
>(() => ({
  challenges: [
    { index: 0, word: "youth" },
    { index: 4, word: "bundle" },
    { index: 8, word: "harvest" },
  ],
}))
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams() }),
}))

loadLocale("en")
const LL = i18nObject("en")

const mockSetBackupCompleted = jest.fn()

describe("SparkBackupConfirmScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockCheckpoint.mockReturnValue(null)
    mockCheckpointLoading.mockReturnValue(false)
    mockRouteParams.mockReturnValue({
      challenges: [
        { index: 0, word: "youth" },
        { index: 4, word: "bundle" },
        { index: 8, word: "harvest" },
      ],
    })
    mockBackupStateValue.mockReturnValue({
      backupState: { status: "none", method: null },
      setBackupCompleted: mockSetBackupCompleted,
    })
    mockActiveWalletValue.mockReturnValue({
      wallets: [{ id: "btc-1", balance: { amount: 1000 }, walletCurrency: "BTC" }],
    })
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

  const fillAllChallenges = (getByPlaceholderText: (p: string) => unknown) => {
    fireEvent.changeText(
      getByPlaceholderText(
        `${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 1`,
      ) as never,
      "youth",
    )
    fireEvent.changeText(
      getByPlaceholderText(
        `${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 5`,
      ) as never,
      "bundle",
    )
    fireEvent.changeText(
      getByPlaceholderText(
        `${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 9`,
      ) as never,
      "harvest",
    )
  }

  it("routes to migration transferring screen when migrating with funds", () => {
    mockCheckpoint.mockReturnValue("backupAlerts")
    mockBackupStateValue.mockReturnValue({
      backupState: { status: "none", method: null },
      setBackupCompleted: mockSetBackupCompleted,
    })

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fillAllChallenges(getByPlaceholderText)
    jest.advanceTimersByTime(500)

    expect(mockSetBackupCompleted).toHaveBeenCalledWith("manual")
    expect(mockNavigate).toHaveBeenCalledWith("sparkMigrationTransferringFunds")
  })

  it("routes to backup success screen with reBackup=true when re-backing-up from settings", () => {
    mockCheckpoint.mockReturnValue("backupAlerts")
    mockBackupStateValue.mockReturnValue({
      backupState: { status: "completed", method: "manual" },
      setBackupCompleted: mockSetBackupCompleted,
    })

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fillAllChallenges(getByPlaceholderText)
    jest.advanceTimersByTime(500)

    expect(mockNavigate).toHaveBeenCalledWith(
      "sparkBackupSuccessScreen",
      expect.objectContaining({ reBackup: true }),
    )
  })

  it("routes to backup success screen with reBackup=false during fresh manual backup without checkpoint", () => {
    mockCheckpoint.mockReturnValue(null)

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fillAllChallenges(getByPlaceholderText)
    jest.advanceTimersByTime(500)

    expect(mockNavigate).toHaveBeenCalledWith(
      "sparkBackupSuccessScreen",
      expect.objectContaining({ reBackup: false }),
    )
  })

  it("does not route to migration when migrating but no funds", () => {
    mockCheckpoint.mockReturnValue("backupAlerts")
    mockActiveWalletValue.mockReturnValue({
      wallets: [{ id: "btc-1", balance: { amount: 0 }, walletCurrency: "BTC" }],
    })

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fillAllChallenges(getByPlaceholderText)
    jest.advanceTimersByTime(500)

    expect(mockNavigate).not.toHaveBeenCalledWith("sparkMigrationTransferringFunds")
    expect(mockNavigate).toHaveBeenCalledWith(
      "sparkBackupSuccessScreen",
      expect.objectContaining({ reBackup: false }),
    )
  })

  it("forwards the route's successMessage to the success screen when provided", () => {
    mockRouteParams.mockReturnValue({
      challenges: [
        { index: 0, word: "youth" },
        { index: 4, word: "bundle" },
        { index: 8, word: "harvest" },
      ],
      successMessage: "Your backup phrase is correct",
    })
    mockBackupStateValue.mockReturnValue({
      backupState: { status: "completed", method: "manual" },
      setBackupCompleted: mockSetBackupCompleted,
    })

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fillAllChallenges(getByPlaceholderText)
    jest.advanceTimersByTime(500)

    expect(mockNavigate).toHaveBeenCalledWith(
      "sparkBackupSuccessScreen",
      expect.objectContaining({
        reBackup: true,
        message: "Your backup phrase is correct",
      }),
    )
  })

  it("does not auto-navigate while the migration checkpoint is still loading (Critical #1)", () => {
    mockCheckpoint.mockReturnValue(null)
    mockCheckpointLoading.mockReturnValue(true)

    const { getByPlaceholderText, rerender } = render(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )

    fillAllChallenges(getByPlaceholderText)
    jest.advanceTimersByTime(500)

    expect(mockNavigate).not.toHaveBeenCalled()

    mockCheckpoint.mockReturnValue("backupAlerts")
    mockCheckpointLoading.mockReturnValue(false)
    rerender(
      <ContextForScreen>
        <SparkBackupConfirmScreen />
      </ContextForScreen>,
    )
    jest.advanceTimersByTime(500)

    expect(mockNavigate).toHaveBeenCalledWith("sparkMigrationTransferringFunds")
  })
})
