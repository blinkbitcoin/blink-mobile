import { act, renderHook, waitFor } from "@testing-library/react-native"

import { usePendingMigrationAccounts } from "@app/screens/account-migration/hooks/use-pending-migration-accounts"

const mockLoadPendingProvisionedAccounts = jest.fn()
const mockSavePendingProvisionedAccount = jest.fn()
const mockClearPendingProvisionedAccount = jest.fn()
let mockActiveAccount: { id: string; type: string } | undefined

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual("react")
    useEffect(() => callback(), [callback])
  },
}))

jest.mock("@app/screens/account-migration/utils/migration-checkpoint-storage", () => ({
  ...jest.requireActual(
    "@app/screens/account-migration/utils/migration-checkpoint-storage",
  ),
  loadPendingProvisionedAccounts: (...args: readonly unknown[]) =>
    mockLoadPendingProvisionedAccounts(...args),
  savePendingProvisionedAccount: (...args: readonly unknown[]) =>
    mockSavePendingProvisionedAccount(...args),
  clearPendingProvisionedAccount: (...args: readonly unknown[]) =>
    mockClearPendingProvisionedAccount(...args),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount }),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { name: "Main" } },
  }),
}))

describe("usePendingMigrationAccounts", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccount = { id: "custodial-1", type: "custodial" }
    mockLoadPendingProvisionedAccounts.mockResolvedValue({})
    mockSavePendingProvisionedAccount.mockResolvedValue(undefined)
    mockClearPendingProvisionedAccount.mockResolvedValue(undefined)
  })

  it("loads the pending map and exposes the active owner's wallet", async () => {
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-1": "sc-pending-1",
      "custodial-2": "sc-pending-2",
    })

    const { result } = renderHook(() => usePendingMigrationAccounts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.pendingForActiveAccount).toBe("sc-pending-1")
    expect(result.current.pendingAccountIds.has("sc-pending-1")).toBe(true)
    expect(result.current.pendingAccountIds.has("sc-pending-2")).toBe(true)
  })

  it("exposes no pending wallet for an owner without one", async () => {
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-2": "sc-pending-2",
    })

    const { result } = renderHook(() => usePendingMigrationAccounts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.pendingForActiveAccount).toBeNull()
  })

  it("persists a newly provisioned wallet under the active custodial owner", async () => {
    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.savePendingAccount("sc-new-1")
    })

    expect(mockSavePendingProvisionedAccount).toHaveBeenCalledWith(
      "migrationPendingAccounts_main",
      { custodialAccountId: "custodial-1", accountId: "sc-new-1" },
    )
    expect(result.current.pendingForActiveAccount).toBe("sc-new-1")
  })

  it("does not persist anything while no account is active", async () => {
    mockActiveAccount = undefined
    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.savePendingAccount("sc-new-1")
    })

    expect(mockSavePendingProvisionedAccount).not.toHaveBeenCalled()
  })

  it("clears the given owner's pending wallet", async () => {
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-1": "sc-pending-1",
    })

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.clearPendingAccount("custodial-1")
    })

    expect(mockClearPendingProvisionedAccount).toHaveBeenCalledWith(
      "migrationPendingAccounts_main",
      "custodial-1",
    )
    expect(result.current.pendingForActiveAccount).toBeNull()
  })
})
