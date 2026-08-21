import React from "react"
import { StyleSheet } from "react-native"

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
    saveCheckpoint: jest.fn().mockResolvedValue(true),
    checkpoint: mockCheckpoint(),
    accountId: mockMigrationAccountId(),
    loading: mockCheckpointLoading(),
  }),
  useMigrationCheckpointState: () => ({
    saveCheckpoint: jest.fn().mockResolvedValue(true),
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
    ChooseExperience: "chooseExperience",
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
const mockReplace = jest.fn()
const mockRouteParams = jest.fn<unknown, []>(() => ({
  challenges: [
    { index: 0, word: "youth" },
    { index: 4, word: "bundle" },
    { index: 8, word: "harvest" },
  ],
}))
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace }),
  useRoute: () => ({ params: mockRouteParams() }),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
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

  /** A confirm screen without its challenges is dead — there is nothing to type — so
   *  missing or malformed params redirect back to the first backup step with `replace`,
   *  keeping the broken route out of the back stack, instead of throwing into the
   *  app-wide ErrorBoundary (#4070). */
  describe("route param guards", () => {
    it("redirects to the first backup step when the route delivers no params", async () => {
      mockRouteParams.mockReturnValue(undefined)

      render(
        <ContextForScreen>
          <BackupPhraseConfirmScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("selfCustodialBackupPhrase", { step: 1 })
      expect(mockReportError).toHaveBeenCalledTimes(1)
      expect(mockReportError).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        expect.objectContaining({
          dedupKey: "backup-confirm-params-missing",
          alwaysRecord: true,
        }),
      )
    })

    it("redirects when the route delivers an empty challenge list", async () => {
      mockRouteParams.mockReturnValue({ challenges: [] })

      render(
        <ContextForScreen>
          <BackupPhraseConfirmScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("selfCustodialBackupPhrase", { step: 1 })
    })

    it("redirects when the route delivers malformed challenge entries", async () => {
      mockRouteParams.mockReturnValue({ challenges: [{ index: "zero" }] })

      render(
        <ContextForScreen>
          <BackupPhraseConfirmScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("selfCustodialBackupPhrase", { step: 1 })
    })

    /** Shape-valid but semantically broken challenges render a prompt the user cannot
     *  answer — "enter word 100" of a 12-word phrase — so they take the same
     *  report-and-redirect path as missing params (#4088 review, I2). */
    it("redirects when a challenge index falls outside the mnemonic", async () => {
      mockRouteParams.mockReturnValue({ challenges: [{ index: 99, word: "abandon" }] })

      render(
        <ContextForScreen>
          <BackupPhraseConfirmScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("selfCustodialBackupPhrase", { step: 1 })
      expect(mockReportError).toHaveBeenCalledTimes(1)
    })

    it("redirects when challenge indexes repeat", async () => {
      mockRouteParams.mockReturnValue({
        challenges: [
          { index: 4, word: "youth" },
          { index: 4, word: "bundle" },
        ],
      })

      render(
        <ContextForScreen>
          <BackupPhraseConfirmScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("selfCustodialBackupPhrase", { step: 1 })
      expect(mockReportError).toHaveBeenCalledTimes(1)
    })

    it("redirects when a challenge word is blank", async () => {
      mockRouteParams.mockReturnValue({ challenges: [{ index: 3, word: "  " }] })

      render(
        <ContextForScreen>
          <BackupPhraseConfirmScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("selfCustodialBackupPhrase", { step: 1 })
      expect(mockReportError).toHaveBeenCalledTimes(1)
    })

    it("redirects when a challenge index is not an integer", async () => {
      mockRouteParams.mockReturnValue({ challenges: [{ index: 1.5, word: "youth" }] })

      render(
        <ContextForScreen>
          <BackupPhraseConfirmScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockReplace).toHaveBeenCalledWith("selfCustodialBackupPhrase", { step: 1 })
      expect(mockReportError).toHaveBeenCalledTimes(1)
    })

    it("neither redirects nor reports for valid challenges", async () => {
      render(
        <ContextForScreen>
          <BackupPhraseConfirmScreen />
        </ContextForScreen>,
      )
      await flushEffects()

      expect(mockReplace).not.toHaveBeenCalled()
      expect(mockReportError).not.toHaveBeenCalled()
    })
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

  it("moves the suggestion target when another input takes focus", async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <ContextForScreen>
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.changeText(
      getByPlaceholderText(`${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 1`),
      "you",
    )
    expect(getByText("youth")).toBeTruthy()

    fireEvent(
      getByPlaceholderText(`${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 5`),
      "focus",
    )

    expect(queryByText("youth")).toBeNull()
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

  /** The number slot stays mounted with a fixed width so the row cannot reflow on the
   *  first keystroke; empty inputs hide it with opacity only. */
  it("reveals the word number when the input gains content", async () => {
    const { getByPlaceholderText, getByText } = render(
      <ContextForScreen>
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(StyleSheet.flatten(getByText("1.").props.style).opacity).toBe(0)

    fireEvent.changeText(
      getByPlaceholderText(`${LL.BackupScreen.ManualBackup.Confirm.enterWord()} 1`),
      "you",
    )
    fireEvent.press(getByText("youth"))

    expect(StyleSheet.flatten(getByText("1.").props.style).opacity).toBeUndefined()
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

  it("routes to the balances overview when migrating", async () => {
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

    expect(mockMarkBackupCompletedFor).toHaveBeenCalledWith("migration-uuid", "manual")
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      onContinue: {
        route: "accountMigrationBalancesOverview",
        accountId: "migration-uuid",
      },
    })
  })

  it("routes to backup success screen with reBackup=true when re-backing-up from settings", async () => {
    mockCheckpoint.mockReturnValue("backupAlerts")
    mockBackupStateValue.mockReturnValue({
      backupState: { status: "completed", method: "manual" },
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

    expect(mockNavigate).toHaveBeenCalledWith(
      "selfCustodialBackupSuccess",
      expect.objectContaining({ reBackup: true }),
    )
  })

  it("routes to backup success screen with reBackup=false during fresh manual backup without checkpoint", async () => {
    mockCheckpoint.mockReturnValue(null)

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

    expect(mockSetBackupCompleted).toHaveBeenCalledWith("manual")
    expect(mockNavigate).toHaveBeenCalledWith(
      "selfCustodialBackupSuccess",
      expect.objectContaining({ reBackup: false }),
    )
  })

  it("routes a no-funds migration to the balances overview too", async () => {
    mockCheckpoint.mockReturnValue("backupAlerts")
    mockActiveWalletValue.mockReturnValue({
      wallets: [{ id: "btc-1", balance: { amount: 0 }, walletCurrency: "BTC" }],
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
    // The migration persists the backup asynchronously before navigating.
    await act(async () => {})

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      onContinue: {
        route: "accountMigrationBalancesOverview",
        accountId: "migration-uuid",
      },
    })
  })

  it("forwards the route's successMessage to the success screen when provided", async () => {
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
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fillAllChallenges(getByPlaceholderText)
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(mockNavigate).toHaveBeenCalledWith(
      "selfCustodialBackupSuccess",
      expect.objectContaining({
        reBackup: true,
        message: "Your backup phrase is correct",
      }),
    )
  })

  it("does not auto-navigate while the migration checkpoint is still loading", async () => {
    mockCheckpoint.mockReturnValue(null)
    mockCheckpointLoading.mockReturnValue(true)

    const { getByPlaceholderText, rerender } = render(
      <ContextForScreen>
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    await flushEffects()

    fillAllChallenges(getByPlaceholderText)
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(mockNavigate).not.toHaveBeenCalled()

    mockCheckpoint.mockReturnValue("backupAlerts")
    mockCheckpointLoading.mockReturnValue(false)
    rerender(
      <ContextForScreen>
        <BackupPhraseConfirmScreen />
      </ContextForScreen>,
    )
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await act(async () => {})

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      onContinue: {
        route: "accountMigrationBalancesOverview",
        accountId: "migration-uuid",
      },
    })
  })
})
