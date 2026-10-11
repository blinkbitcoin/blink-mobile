import { act, renderHook, waitFor } from "@testing-library/react-native"

import { usePendingProvisionedWallets } from "@app/screens/account-migration/hooks/use-pending-provisioned-wallets"

const mockReadPendingProvisionedAccounts = jest.fn()
const mockClearPendingProvisionedWallet = jest.fn()
const mockRepairPendingProvisionedAccounts = jest.fn()
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
  readPendingProvisionedAccounts: (...args: readonly unknown[]) =>
    mockReadPendingProvisionedAccounts(...args),
  clearPendingProvisionedWallet: (...args: readonly unknown[]) =>
    mockClearPendingProvisionedWallet(...args),
  repairPendingProvisionedAccounts: (...args: readonly unknown[]) =>
    mockRepairPendingProvisionedAccounts(...args),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: "Main" } } }),
}))

describe("usePendingProvisionedWallets", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseCustodialOwnerId.mockReturnValue({ ownerId: "custodial-1", loading: false })
    mockReadPendingProvisionedAccounts.mockResolvedValue({
      status: "ok",
      pendingByOwner: {},
    })
    mockClearPendingProvisionedWallet.mockResolvedValue(undefined)
    mockRepairPendingProvisionedAccounts.mockResolvedValue(undefined)
  })

  /**
   * The reason this hook exists apart from usePendingMigrationAccounts: the owner id comes
   * from a no-cache `me` query, and the deletion guard consults the record on every focus of
   * the account switcher without ever reading who owns it.
   */
  it("never asks who owns the wallets", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValue({
      status: "ok",
      pendingByOwner: {
        "custodial-1": "sc-wallet-1",
      },
    })

    const { result } = renderHook(() => usePendingProvisionedWallets())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockUseCustodialOwnerId).not.toHaveBeenCalled()
  })

  it("exposes every provisioned wallet on the device, across owners", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValue({
      status: "ok",
      pendingByOwner: {
        "custodial-1": "sc-wallet-1",
        "custodial-2": "sc-wallet-2",
      },
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
    mockReadPendingProvisionedAccounts.mockResolvedValue({
      status: "ok",
      pendingByOwner: {
        "custodial-1": "sc-wallet-1",
        "custodial-2": "sc-wallet-2",
      },
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
    mockReadPendingProvisionedAccounts.mockResolvedValue({
      status: "ok",
      pendingByOwner: {
        "custodial-1": "sc-wallet-1",
      },
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
    mockReadPendingProvisionedAccounts.mockResolvedValueOnce({ status: "read-failed" })
    mockReadPendingProvisionedAccounts.mockResolvedValue({
      status: "ok",
      pendingByOwner: {
        "custodial-1": "sc-wallet-1",
      },
    })

    const { result } = renderHook(() => usePendingProvisionedWallets())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.hasError).toBe(false)
    expect(result.current.pendingAccountIds.has("sc-wallet-1")).toBe(true)
  })

  /**
   * Nothing is recoverable from a corrupt value, and only a write repairs it while writes
   * run only during a migration. Left alone it would block provisioning and deletion alike
   * for good.
   */
  describe("a record that will not parse", () => {
    const corruptRead = { status: "corrupt", error: new Error("not a record") }

    it("repairs it and reads the empty record it has become", async () => {
      mockReadPendingProvisionedAccounts.mockResolvedValueOnce(corruptRead)
      mockReadPendingProvisionedAccounts.mockResolvedValue({
        status: "ok",
        pendingByOwner: {},
      })

      const { result } = renderHook(() => usePendingProvisionedWallets())
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(mockRepairPendingProvisionedAccounts).toHaveBeenCalledWith(
        "migrationPendingAccounts_main",
      )
      expect(result.current.hasError).toBe(false)
      expect(result.current.pendingAccountIds.size).toBe(0)
    })

    it("reports the cause once rather than on every focus", async () => {
      mockReadPendingProvisionedAccounts.mockResolvedValueOnce(corruptRead)
      mockReadPendingProvisionedAccounts.mockResolvedValue({
        status: "ok",
        pendingByOwner: {},
      })

      const { result } = renderHook(() => usePendingProvisionedWallets())
      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(mockReportError).toHaveBeenCalledWith(
        "Pending migration accounts repair",
        expect.any(Error),
        { dedupKey: "pending-migration-accounts-corrupt" },
      )
    })

    /**
     * Until the repair lands the record is still unreadable, which is what `deleteWallet`
     * independently decides too. Reporting it empty here is what would offer a delete
     * control that then refuses.
     */
    it("stays in error when the repair itself cannot be written", async () => {
      mockReadPendingProvisionedAccounts.mockResolvedValue(corruptRead)
      mockRepairPendingProvisionedAccounts.mockRejectedValue(new Error("write failed"))

      const { result } = renderHook(() => usePendingProvisionedWallets())

      await waitFor(() => expect(result.current.hasError).toBe(true))
      expect(result.current.loading).toBe(false)
    })
  })
})
