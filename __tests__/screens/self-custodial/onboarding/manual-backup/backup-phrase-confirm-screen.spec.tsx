import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { BackupPhraseConfirmScreen } from "@app/screens/self-custodial/onboarding/manual-backup/backup-phrase-confirm-screen"
import { ContextForScreen } from "../../../helper"
import { flushEffects } from "../../../../helpers/flush-effects"

jest.mock("react-native-inappbrowser-reborn", () => ({
  __esModule: true,
  default: { open: jest.fn(() => Promise.resolve()) },
}))

const mockCheckpoint = jest.fn<string | null, []>()
const mockCheckpointLoading = jest.fn<boolean, []>()
const mockMigrationAccountId = jest.fn<string | null, []>()
jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationCheckpoint: () => ({
    saveCheckpoint: jest.fn(),
    checkpoint: mockCheckpoint(),
    accountId: mockMigrationAccountId(),
    loading: mockCheckpointLoading(),
  }),
  useMigrationCheckpointState: () => ({
    saveCheckpoint: jest.fn(),
    checkpoint: mockCheckpoint(),
    accountId: mockMigrationAccountId(),
    loading: mockCheckpointLoading(),
  }),
  useCompleteMigration: () => ({
    migrationCheckpoint: mockCheckpoint(),
    migrationAccountId: mockMigrationAccountId(),
    completeMigration: jest.fn().mockResolvedValue(true),
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
const mockMarkBackupCompletedFor = jest.fn().mockResolvedValue(undefined)
jest.mock("@app/self-custodial/providers/backup-state", () => ({
  BackupStatus: { None: "none", Completed: "completed" },
  BackupMethod: { Cloud: "cloud", Keychain: "keychain", Manual: "manual" },
  useBackupState: () => mockBackupStateValue(),
  markBackupCompletedFor: (...args: readonly unknown[]) =>
    mockMarkBackupCompletedFor(...args),
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

describe("BackupPhraseConfirmScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    mockCheckpoint.mockReturnValue(null)
    mockMigrationAccountId.mockReturnValue("migration-uuid")
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

  it("renders subtitle and input fields", async () => {
    const { getByText, getByPlaceholderText } = render(
      <ContextForScreen>
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    await flushEffects()

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

  it("shows enter words label when inputs are empty", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText(LL.BackupScreen.ManualBackup.Confirm.enterWords())).toBeTruthy()
  })

  it("shows autocomplete suggestions when typing 3+ characters", async () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.changeText(
      getByPlaceholderText(`${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 1`),
      "you",
    )

    expect(getByText("young")).toBeTruthy()
    expect(getByText("youth")).toBeTruthy()
  })

  it("fills input when suggestion is selected", async () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    const input = getByPlaceholderText(
      `${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 1`,
    )
    fireEvent.changeText(input, "you")
    fireEvent.press(getByText("youth"))

    expect(input.props.value).toBe("youth")
  })

  it("shows word number when input has content", async () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    await flushEffects()

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

  it("hands off to the recovery-backup export step instead of completing here", async () => {
    mockCheckpoint.mockReturnValue("backupAlerts")
    mockBackupStateValue.mockReturnValue({
      backupState: { status: "none", method: null },
      setBackupCompleted: mockSetBackupCompleted,
    })

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fillAllChallenges(getByPlaceholderText)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await act(async () => {})

    // The phrase is only half of what the user needs; the backup is not
    // complete until the recovery backup has been handed over too.
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupBundleExport", {
      successMessage: undefined,
    })
    expect(mockSetBackupCompleted).not.toHaveBeenCalled()
    expect(mockMarkBackupCompletedFor).not.toHaveBeenCalled()
  })

  it("forwards the route's successMessage to the export step", async () => {
    mockCheckpoint.mockReturnValue(null)
    mockRouteParams.mockReturnValue({
      challenges: [
        { index: 0, word: "youth" },
        { index: 4, word: "bundle" },
        { index: 8, word: "harvest" },
      ],
      successMessage: "Your backup phrase is correct",
    })
    mockBackupStateValue.mockReturnValue({
      backupState: { status: "none", method: null },
      setBackupCompleted: mockSetBackupCompleted,
    })

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fillAllChallenges(getByPlaceholderText)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await act(async () => {})

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupBundleExport", {
      successMessage: "Your backup phrase is correct",
    })
  })

  it("does not auto-navigate while the migration checkpoint is still loading", async () => {
    mockCheckpointLoading.mockReturnValue(true)
    mockCheckpoint.mockReturnValue("backupAlerts")
    mockBackupStateValue.mockReturnValue({
      backupState: { status: "none", method: null },
      setBackupCompleted: mockSetBackupCompleted,
    })

    const { getByPlaceholderText } = render(
      <ContextForScreen>
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fillAllChallenges(getByPlaceholderText)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await act(async () => {})

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
