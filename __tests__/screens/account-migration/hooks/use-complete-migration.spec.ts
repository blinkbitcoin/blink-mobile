import { renderHook, act } from "@testing-library/react-native"

import { AccountCloseOutcome } from "@app/screens/account-migration/hooks/use-close-custodial-account"
import { MigrationCompletion } from "@app/types/migration"

const mockClearCheckpoint = jest.fn()
const mockSetActiveAccountId = jest.fn()
const mockDiscardCustodialSession = jest.fn()
const mockCloseCustodialAccount = jest.fn()

let mockAccountId: string | undefined
let mockCheckpoint: string | null
let mockExpectedReceiveSats: number | null
let mockCheckpointOwnerId: string | null

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint-state", () => ({
  useMigrationCheckpointState: () => ({
    checkpoint: mockCheckpoint,
    accountId: mockAccountId,
    expectedReceiveSats: mockExpectedReceiveSats,
    checkpointOwnerId: mockCheckpointOwnerId,
    clearCheckpoint: mockClearCheckpoint,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-close-custodial-account", () => ({
  ...jest.requireActual(
    "@app/screens/account-migration/hooks/use-close-custodial-account",
  ),
  useCloseCustodialAccount: () => ({
    closeCustodialAccount: mockCloseCustodialAccount,
  }),
}))

jest.mock("@app/screens/account-migration/hooks/use-discard-custodial-session", () => ({
  useDiscardCustodialSession: () => ({
    discardCustodialSession: mockDiscardCustodialSession,
  }),
}))

let mockAccounts: { id: string }[] = []
let mockRegistryLoading = false

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    setActiveAccountId: mockSetActiveAccountId,
    accounts: mockAccounts,
    loading: mockRegistryLoading,
  }),
}))

let mockOwnerId: string | null = "custodial-1"

jest.mock("@app/screens/account-migration/hooks/use-custodial-owner-id", () => ({
  useCustodialOwnerId: () => ({ ownerId: mockOwnerId, loading: false }),
}))

const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  ...jest.requireActual("@app/utils/error-logging"),
  reportError: (operation: string, err: unknown, options?: unknown) =>
    mockReportError(operation, err, options),
}))

const mockClearPendingAccount = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-pending-migration-accounts", () => ({
  usePendingMigrationAccounts: () => ({
    clearPendingAccount: mockClearPendingAccount,
  }),
}))

const mockSeedMigratedSettings = jest.fn()

jest.mock(
  "@app/screens/account-migration/hooks/use-seed-migrated-account-settings",
  () => ({
    useSeedMigratedAccountSettings: () => ({
      seedMigratedSettings: mockSeedMigratedSettings,
    }),
  }),
)

import { useCompleteMigration } from "@app/screens/account-migration/hooks/use-complete-migration"

const complete = async (): Promise<MigrationCompletion | undefined> => {
  const { result } = renderHook(() => useCompleteMigration())
  let outcome: MigrationCompletion | undefined
  await act(async () => {
    outcome = await result.current.completeMigration()
  })
  return outcome
}

describe("useCompleteMigration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountId = "sc-account-1"
    mockOwnerId = "custodial-1"
    mockCheckpointOwnerId = "custodial-1"
    mockAccounts = [{ id: "sc-account-1" }]
    mockRegistryLoading = false
    mockCheckpoint = "backupAlerts"
    mockExpectedReceiveSats = 21000
    mockDiscardCustodialSession.mockResolvedValue(undefined)
    mockSeedMigratedSettings.mockResolvedValue(undefined)
    mockCloseCustodialAccount.mockResolvedValue(AccountCloseOutcome.Closed)
  })

  it("does nothing and reports the account missing when none has been provisioned", async () => {
    mockAccountId = undefined

    expect(await complete()).toBe(MigrationCompletion.AccountMissing)
    expect(mockCloseCustodialAccount).not.toHaveBeenCalled()
    expect(mockSetActiveAccountId).not.toHaveBeenCalled()
    expect(mockDiscardCustodialSession).not.toHaveBeenCalled()
    expect(mockClearCheckpoint).not.toHaveBeenCalled()
  })

  it("keeps the custodial session when the provisioned account is gone", async () => {
    mockAccounts = []

    expect(await complete()).toBe(MigrationCompletion.AccountMissing)
    expect(mockCloseCustodialAccount).not.toHaveBeenCalled()
    expect(mockDiscardCustodialSession).not.toHaveBeenCalled()
    expect(mockSetActiveAccountId).not.toHaveBeenCalled()
    expect(mockClearCheckpoint).not.toHaveBeenCalled()
  })

  it("closes the account, discards the session, swaps, then clears the checkpoint", async () => {
    expect(await complete()).toBe(MigrationCompletion.Completed)

    /** The close is handed the custodial id so its report can name the account a refusal
     *  would leave open. */
    expect(mockCloseCustodialAccount).toHaveBeenCalledWith("custodial-1")
    expect(mockSetActiveAccountId).toHaveBeenCalledWith("sc-account-1")
    expect(mockDiscardCustodialSession).toHaveBeenCalledTimes(1)
    expect(mockClearCheckpoint).toHaveBeenCalledTimes(1)
  })

  /** The close authenticates with the token the discard destroys, so it cannot go second. */
  it("closes the account before the discard spends its token", async () => {
    await complete()

    expect(mockCloseCustodialAccount.mock.invocationCallOrder[0]).toBeLessThan(
      mockDiscardCustodialSession.mock.invocationCallOrder[0],
    )
  })

  it("discards the fallible custodial session before activating the new account", async () => {
    await complete()

    expect(mockDiscardCustodialSession.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetActiveAccountId.mock.invocationCallOrder[0],
    )
  })

  /** The deletion already killed the Kratos identity, so revoking would be a doomed call. */
  it("tells the discard the session is already dead after a successful close", async () => {
    await complete()

    expect(mockDiscardCustodialSession).toHaveBeenCalledWith({ isSessionAlive: false })
  })

  it("keeps the custodial session active and the checkpoint intact when the discard fails", async () => {
    mockDiscardCustodialSession.mockRejectedValue(new Error("keystore failure"))

    const { result } = renderHook(() => useCompleteMigration())
    await act(async () => {
      await expect(result.current.completeMigration()).rejects.toThrow("keystore failure")
    })

    expect(mockSetActiveAccountId).not.toHaveBeenCalled()
    expect(mockClearCheckpoint).not.toHaveBeenCalled()
  })

  /** Completion is the only moment every path passes through — a resumed run never mounts
   *  the migration screens — and the discard below it is what makes the custodial values
   *  unreachable, so the copy has to happen here and in this order (#4099). */
  it("copies the custodial settings while the session is still live", async () => {
    await complete()

    expect(mockSeedMigratedSettings).toHaveBeenCalledWith("sc-account-1")
    expect(mockSeedMigratedSettings.mock.invocationCallOrder[0]).toBeLessThan(
      mockDiscardCustodialSession.mock.invocationCallOrder[0],
    )
  })

  it("completes the migration even when copying the settings fails", async () => {
    mockSeedMigratedSettings.mockRejectedValue(new Error("settings fetch exploded"))

    expect(await complete()).toBe(true)
    expect(mockDiscardCustodialSession).toHaveBeenCalledTimes(1)
    expect(mockSetActiveAccountId).toHaveBeenCalledWith("sc-account-1")
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration settings carry-over",
      expect.any(Error),
    )
  })

  it("copies nothing when there is no account to copy onto", async () => {
    mockAccountId = undefined

    await complete()

    expect(mockSeedMigratedSettings).not.toHaveBeenCalled()
  })

  it("copies nothing when the provisioned account is gone", async () => {
    mockAccounts = []

    await complete()

    expect(mockSeedMigratedSettings).not.toHaveBeenCalled()
  })

  it("surfaces the migration checkpoint and provisioned account id", () => {
    const { result } = renderHook(() => useCompleteMigration())

    expect(result.current.migrationCheckpoint).toBe("backupAlerts")
    expect(result.current.migrationAccountId).toBe("sc-account-1")
    expect(result.current.migrationExpectedReceiveSats).toBe(21000)
  })

  /** A handover raised after the discard has no session left to ask, so it needs the id
   *  from here to name the custodial account support has to close. */
  it("surfaces the custodial account id for a handover raised after the swap", () => {
    const { result } = renderHook(() => useCompleteMigration())

    expect(result.current.custodialAccountId).toBe("custodial-1")
  })

  /** The account check reads the registry's accounts, which start empty and fill after an
   *  async keystore read on a resume launch; reporting loading until the registry hydrates
   *  stops a swap decided too early from reading a present destination as missing. */
  it("stays loading until the account registry has hydrated", () => {
    mockRegistryLoading = true
    const { result } = renderHook(() => useCompleteMigration())

    expect(result.current.migrationLoading).toBe(true)
  })

  it("clears the custodial owner's pending wallet record after the swap", async () => {
    await complete()

    expect(mockClearPendingAccount).toHaveBeenCalledWith("custodial-1")
  })

  describe("when the close does not settle", () => {
    beforeEach(() => {
      mockCloseCustodialAccount.mockResolvedValue(AccountCloseOutcome.Retryable)
    })

    it("reports the close unavailable", async () => {
      expect(await complete()).toBe(MigrationCompletion.CloseUnavailable)
    })

    /** The token is the only thing that can authenticate the deletion, and the discard
     *  destroys it: spending it here would make the close impossible forever. */
    it("keeps the custodial session so a later attempt can still close the account", async () => {
      await complete()

      expect(mockDiscardCustodialSession).not.toHaveBeenCalled()
      expect(mockSetActiveAccountId).not.toHaveBeenCalled()
    })

    it("keeps the checkpoint so the next launch resumes the close", async () => {
      await complete()

      expect(mockClearCheckpoint).not.toHaveBeenCalled()
      expect(mockClearPendingAccount).not.toHaveBeenCalled()
    })
  })

  describe("when the server refuses the close for good", () => {
    beforeEach(() => {
      mockCloseCustodialAccount.mockResolvedValue(AccountCloseOutcome.Refused)
    })

    it("reports the refusal", async () => {
      expect(await complete()).toBe(MigrationCompletion.CloseRefused)
    })

    /** The funds are already self-custodial: holding the user on a dead custodial session
     *  would cost them their wallet over an account only support can remove. */
    it("finishes the migration anyway", async () => {
      await complete()

      expect(mockDiscardCustodialSession).toHaveBeenCalledTimes(1)
      expect(mockSetActiveAccountId).toHaveBeenCalledWith("sc-account-1")
      expect(mockClearCheckpoint).toHaveBeenCalledTimes(1)
      expect(mockClearPendingAccount).toHaveBeenCalledWith("custodial-1")
    })

    /** The account survived, so its session is alive and the revocation is worth making. */
    it("still revokes the surviving session", async () => {
      await complete()

      expect(mockDiscardCustodialSession).toHaveBeenCalledWith({ isSessionAlive: true })
    })
  })

  /** The owner query answers on its own schedule, and a launch with no connection has it
   *  answering nothing at all. Nothing is spent and nothing is claimed until it does. */
  describe("when the session owner has not resolved", () => {
    beforeEach(() => {
      mockOwnerId = null
    })

    it("waits rather than aiming an irreversible call at an unproven account", async () => {
      expect(await complete()).toBe(MigrationCompletion.CloseUnavailable)
      expect(mockCloseCustodialAccount).not.toHaveBeenCalled()
    })

    it("keeps the session and the checkpoint intact for the retry", async () => {
      await complete()

      expect(mockDiscardCustodialSession).not.toHaveBeenCalled()
      expect(mockSetActiveAccountId).not.toHaveBeenCalled()
      expect(mockClearCheckpoint).not.toHaveBeenCalled()
      expect(mockClearPendingAccount).not.toHaveBeenCalled()
    })

    /** A pending query is a waiting state, not a fault: reporting it would raise a non-fatal
     *  on every offline launch and every retry press. */
    it("does not report a state the next attempt can still resolve", async () => {
      await complete()

      expect(mockReportError).not.toHaveBeenCalled()
    })
  })

  /** The deletion lands on whatever account the active token authenticates, so a checkpoint
   *  that does not name its owner can never prove which account it would hit. */
  describe("when the checkpoint's owner cannot be matched to the session", () => {
    it("never deletes an account the checkpoint was not proven to own", async () => {
      mockCheckpointOwnerId = "custodial-2"

      expect(await complete()).toBe(MigrationCompletion.CloseRefused)
      expect(mockCloseCustodialAccount).not.toHaveBeenCalled()
    })

    /** A record written before owners existed is claimed by whoever is active, so it can
     *  serve another profile's account id, and no later attempt makes it provable. */
    it("treats an owner-less checkpoint the same way", async () => {
      mockCheckpointOwnerId = null

      expect(await complete()).toBe(MigrationCompletion.CloseRefused)
      expect(mockCloseCustodialAccount).not.toHaveBeenCalled()
    })

    /** The funds are already self-custodial and no retry can ever prove the owner, so the
     *  migration finishes here: the alternative is a user holding their wallet behind a
     *  button that will never work. The account itself goes to support. */
    it("finishes the migration instead of holding the user behind a doomed retry", async () => {
      mockCheckpointOwnerId = null
      await complete()

      expect(mockDiscardCustodialSession).toHaveBeenCalledWith({ isSessionAlive: true })
      expect(mockSetActiveAccountId).toHaveBeenCalledWith("sc-account-1")
      expect(mockClearCheckpoint).toHaveBeenCalledTimes(1)
    })

    it("reports the mismatch with both ids", async () => {
      mockCheckpointOwnerId = "custodial-2"
      await complete()

      expect(mockReportError).toHaveBeenCalledWith(
        "Migration completion owner mismatch",
        expect.objectContaining({
          message:
            "Migration completion owner mismatch: checkpoint custodial-2, session custodial-1",
        }),
        { dedupKey: "migration-completion-owner-mismatch" },
      )
    })
  })

  /** The resume hook stays mounted under the migration stack, so it and the transfer screen
   *  can both decide to finish at the same moment. */
  describe("when two callers complete at the same time", () => {
    it("deletes the account once and gives both callers the same answer", async () => {
      let releaseClose: (outcome: AccountCloseOutcome) => void = () => {}
      mockCloseCustodialAccount.mockImplementation(
        () =>
          new Promise<AccountCloseOutcome>((resolve) => {
            releaseClose = resolve
          }),
      )

      const { result } = renderHook(() => useCompleteMigration())
      let outcomes: MigrationCompletion[] = []
      await act(async () => {
        const first = result.current.completeMigration()
        const second = result.current.completeMigration()
        releaseClose(AccountCloseOutcome.Closed)
        outcomes = await Promise.all([first, second])
      })

      expect(mockCloseCustodialAccount).toHaveBeenCalledTimes(1)
      /** The loser waits on the winner rather than being told "unavailable": both watch the
       *  same migration, and a retry footer over a migration that just finished is a lie the
       *  user cannot resolve. */
      expect(outcomes).toEqual([
        MigrationCompletion.Completed,
        MigrationCompletion.Completed,
      ])
      expect(mockDiscardCustodialSession).toHaveBeenCalledTimes(1)
    })

    it("frees the guard once the completion settles", async () => {
      await complete()

      expect(await complete()).toBe(MigrationCompletion.Completed)
      expect(mockCloseCustodialAccount).toHaveBeenCalledTimes(2)
    })
  })
})
