import { act, renderHook, waitFor } from "@testing-library/react-native"

import { usePendingProvisionedWallets } from "@app/screens/account-migration/hooks/use-pending-provisioned-wallets"

const mockLoadPendingProvisionedAccounts = jest.fn()
const mockClearPendingProvisionedWallet = jest.fn()
const mockUseCustodialOwnerId = jest.fn()
const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

jest.mock("@app/screens/account-migration/hooks/use-custodial-owner-id", () => ({
  useCustodialOwnerId: () => mockUseCustodialOwnerId(),
}))

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
  clearPendingProvisionedWallet: (...args: readonly unknown[]) =>
    mockClearPendingProvisionedWallet(...args),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: "Main" } } }),
}))

describe("usePendingProvisionedWallets", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseCustodialOwnerId.mockReturnValue({ ownerId: "custodial-1", loading: false })
    mockLoadPendingProvisionedAccounts.mockResolvedValue({})
    mockClearPendingProvisionedWallet.mockResolvedValue(undefined)
  })

  /**
   * The reason this hook exists apart from usePendingMigrationAccounts: the owner id comes
   * from a no-cache `me` query, and the deletion guard consults the record on every focus of
   * the account switcher without ever reading who owns it.
   */
  it("never asks who owns the wallets", async () => {
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-1": "sc-wallet-1",
    })

    const { result } = renderHook(() => usePendingProvisionedWallets())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockUseCustodialOwnerId).not.toHaveBeenCalled()
  })

  it("exposes every provisioned wallet on the device, across owners", async () => {
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-1": "sc-wallet-1",
      "custodial-2": "sc-wallet-2",
    })

    const { result } = renderHook(() => usePendingProvisionedWallets())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.pendingAccountIds.has("sc-wallet-1")).toBe(true)
    expect(result.current.pendingAccountIds.has("sc-wallet-2")).toBe(true)
    expect(result.current.pendingAccountIds.size).toBe(2)
  })

  it("starts out loading, so no caller reads an empty record as settled", async () => {
    const { result } = renderHook(() => usePendingProvisionedWallets())

    expect(result.current.loading).toBe(true)
    expect(result.current.pendingAccountIds.size).toBe(0)

    /** Drain the read before leaving, or its state update lands outside act. */
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it("drops a mark by wallet id once its write lands", async () => {
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-1": "sc-wallet-1",
      "custodial-2": "sc-wallet-2",
    })

    const { result } = renderHook(() => usePendingProvisionedWallets())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.clearPendingWallet("sc-wallet-1")
    })

    expect(mockClearPendingProvisionedWallet).toHaveBeenCalledWith(
      "migrationPendingAccounts_main",
      "sc-wallet-1",
    )
    expect(result.current.pendingAccountIds.has("sc-wallet-1")).toBe(false)
    expect(result.current.pendingAccountIds.has("sc-wallet-2")).toBe(true)
  })

  /** The mark gates deletion and deleteWallet re-reads it from storage, so memory may never
   *  claim a mark is gone that the write failed to remove. */
  it("keeps the mark in memory when its write fails, and reports", async () => {
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-1": "sc-wallet-1",
    })
    mockClearPendingProvisionedWallet.mockRejectedValue(new Error("clear failed"))

    const { result } = renderHook(() => usePendingProvisionedWallets())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.clearPendingWallet("sc-wallet-1")
    })

    expect(mockReportError).toHaveBeenCalledWith(
      "Pending migration wallet clear",
      expect.any(Error),
    )
    expect(result.current.pendingAccountIds.has("sc-wallet-1")).toBe(true)
  })

  it("raises hasError on a failed read and clears it on a successful retry", async () => {
    mockLoadPendingProvisionedAccounts.mockRejectedValueOnce(new Error("read failed"))
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-1": "sc-wallet-1",
    })

    const { result } = renderHook(() => usePendingProvisionedWallets())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.hasError).toBe(false)
    expect(result.current.pendingAccountIds.has("sc-wallet-1")).toBe(true)
  })
})
