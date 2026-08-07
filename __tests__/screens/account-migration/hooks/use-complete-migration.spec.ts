import { renderHook, act } from "@testing-library/react-native"

import { AccountCloseOutcome } from "@app/screens/account-migration/hooks/use-close-custodial-account"
import { MigrationCompletion } from "@app/types/migration"

const mockClearCheckpoint = jest.fn()
const mockSetActiveAccountId = jest.fn()
const mockDiscardCustodialSession = jest.fn()
const mockCloseCustodialAccount = jest.fn()

let mockAccountId: string | undefined
let mockCheckpoint: string | null

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint-state", () => ({
  useMigrationCheckpointState: () => ({
    checkpoint: mockCheckpoint,
    accountId: mockAccountId,
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

jest.mock("@app/screens/account-migration/hooks/use-custodial-owner-id", () => ({
  useCustodialOwnerId: () => ({ ownerId: "custodial-1", loading: false }),
}))

const mockClearPendingAccount = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-pending-migration-accounts", () => ({
  usePendingMigrationAccounts: () => ({
    clearPendingAccount: mockClearPendingAccount,
  }),
}))

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
    mockAccounts = [{ id: "sc-account-1" }]
    mockRegistryLoading = false
    mockCheckpoint = "backupAlerts"
    mockDiscardCustodialSession.mockResolvedValue(undefined)
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

  it("surfaces the migration checkpoint and provisioned account id", () => {
    const { result } = renderHook(() => useCompleteMigration())

    expect(result.current.migrationCheckpoint).toBe("backupAlerts")
    expect(result.current.migrationAccountId).toBe("sc-account-1")
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
})
