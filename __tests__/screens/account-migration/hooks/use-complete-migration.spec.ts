import { renderHook, act } from "@testing-library/react-native"

const mockClearCheckpoint = jest.fn()
const mockSetActiveAccountId = jest.fn()
const mockDiscardCustodialSession = jest.fn()

let mockAccountId: string | undefined
let mockCheckpoint: string | null

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint-state", () => ({
  useMigrationCheckpointState: () => ({
    checkpoint: mockCheckpoint,
    accountId: mockAccountId,
    clearCheckpoint: mockClearCheckpoint,
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

const complete = async (): Promise<boolean | undefined> => {
  const { result } = renderHook(() => useCompleteMigration())
  let outcome: boolean | undefined
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
  })

  it("does nothing and returns false when no account has been provisioned", async () => {
    mockAccountId = undefined

    expect(await complete()).toBe(false)
    expect(mockSetActiveAccountId).not.toHaveBeenCalled()
    expect(mockDiscardCustodialSession).not.toHaveBeenCalled()
    expect(mockClearCheckpoint).not.toHaveBeenCalled()
  })

  it("keeps the custodial session and returns false when the provisioned account is gone", async () => {
    mockAccounts = []

    expect(await complete()).toBe(false)
    expect(mockDiscardCustodialSession).not.toHaveBeenCalled()
    expect(mockSetActiveAccountId).not.toHaveBeenCalled()
    expect(mockClearCheckpoint).not.toHaveBeenCalled()
  })

  it("discards the custodial session, swaps to the provisioned account, then clears the checkpoint", async () => {
    expect(await complete()).toBe(true)

    expect(mockSetActiveAccountId).toHaveBeenCalledWith("sc-account-1")
    expect(mockDiscardCustodialSession).toHaveBeenCalledTimes(1)
    expect(mockClearCheckpoint).toHaveBeenCalledTimes(1)
  })

  it("discards the fallible custodial session before activating the new account", async () => {
    await complete()

    expect(mockDiscardCustodialSession.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetActiveAccountId.mock.invocationCallOrder[0],
    )
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
})
