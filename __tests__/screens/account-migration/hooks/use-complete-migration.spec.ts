import { renderHook, act } from "@testing-library/react-native"

const mockClearCheckpoint = jest.fn()
const mockSetActiveAccountId = jest.fn()
const mockDiscardCustodialSession = jest.fn()

let mockAccountId: string | undefined
let mockCheckpoint: string | null

jest.mock("@app/screens/account-migration/hooks/use-migration-checkpoint", () => ({
  useMigrationCheckpoint: () => ({
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

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ setActiveAccountId: mockSetActiveAccountId }),
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

  it("swaps to the provisioned account, discards the custodial session, then clears the checkpoint", async () => {
    expect(await complete()).toBe(true)

    expect(mockSetActiveAccountId).toHaveBeenCalledWith("sc-account-1")
    expect(mockDiscardCustodialSession).toHaveBeenCalledTimes(1)
    expect(mockClearCheckpoint).toHaveBeenCalledTimes(1)
  })

  it("swaps the active account before discarding the custodial session", async () => {
    await complete()

    expect(mockSetActiveAccountId.mock.invocationCallOrder[0]).toBeLessThan(
      mockDiscardCustodialSession.mock.invocationCallOrder[0],
    )
  })

  it("surfaces the migration checkpoint and provisioned account id", () => {
    const { result } = renderHook(() => useCompleteMigration())

    expect(result.current.migrationCheckpoint).toBe("backupAlerts")
    expect(result.current.migrationAccountId).toBe("sc-account-1")
  })
})
