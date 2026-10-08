import { act, renderHook, waitFor } from "@testing-library/react-native"

import { usePendingMigrationAccounts } from "@app/screens/account-migration/hooks/use-pending-migration-accounts"

const mockReadPendingProvisionedAccounts = jest.fn()
const mockSavePendingProvisionedAccount = jest.fn()
const mockClearPendingProvisionedWallet = jest.fn()
const mockReportError = jest.fn()
let mockActiveAccount: { id: string; type: string } | undefined
let mockOwnerId: string | null = "custodial-1"

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

jest.mock("@app/screens/account-migration/hooks/use-custodial-owner-id", () => ({
  useCustodialOwnerId: () => ({ ownerId: mockOwnerId, loading: false }),
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
  savePendingProvisionedAccount: (...args: readonly unknown[]) =>
    mockSavePendingProvisionedAccount(...args),
  clearPendingProvisionedWallet: (...args: readonly unknown[]) =>
    mockClearPendingProvisionedWallet(...args),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount }),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { name: "Main" } },
  }),
}))

/** The strict read's successful shape. A failed read is an answer of its own, below. */
const storedRecord = (pendingByOwner: Record<string, string>) => ({
  status: "ok",
  pendingByOwner,
})

/** The strict read answers a failure rather than throwing it, so the record stays
 *  distinguishable from one that is simply empty. */
const failedRead = {
  status: "read-failed",
  error: new Error("AsyncStorage unavailable"),
}

describe("usePendingMigrationAccounts", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccount = { id: "custodial-1", type: "custodial" }
    mockOwnerId = "custodial-1"
    mockReadPendingProvisionedAccounts.mockResolvedValue(storedRecord({}))
    mockSavePendingProvisionedAccount.mockResolvedValue(undefined)
    mockClearPendingProvisionedWallet.mockResolvedValue(undefined)
  })

  it("loads the pending map and exposes the active owner's wallet", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValue(
      storedRecord({
        "custodial-1": "sc-pending-1",
        "custodial-2": "sc-pending-2",
      }),
    )

    const { result } = renderHook(() => usePendingMigrationAccounts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.pendingForActiveAccount).toBe("sc-pending-1")
    expect(result.current.pendingAccountIds.has("sc-pending-1")).toBe(true)
    expect(result.current.pendingAccountIds.has("sc-pending-2")).toBe(true)
  })

  it("exposes no pending wallet for an owner without one", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValue(
      storedRecord({
        "custodial-2": "sc-pending-2",
      }),
    )

    const { result } = renderHook(() => usePendingMigrationAccounts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.pendingForActiveAccount).toBeNull()
  })

  /** Two custodial profiles on one device each key by their own Galoy account id, so one
   *  profile never sees the other's provisioned wallet. */
  it("keeps each custodial profile's pending wallet separate", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValue(
      storedRecord({
        "custodial-1": "sc-pending-1",
        "custodial-2": "sc-pending-2",
      }),
    )
    mockOwnerId = "custodial-2"

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.pendingForActiveAccount).toBe("sc-pending-2")
  })

  /**
   * The mark is what keeps a wallet undeletable while a migration still owes it funds, so
   * switching into that wallet by hand must NOT drop it: that is the exact state where the
   * only key to the funds in flight would otherwise become deletable.
   */
  it("keeps the mark when its wallet is already the active account", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValue(
      storedRecord({ "custodial-1": "sc-wallet-1" }),
    )
    mockActiveAccount = { id: "sc-wallet-1", type: "selfCustodial" }

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.pendingAccountIds.has("sc-wallet-1")).toBe(true)
    expect(mockClearPendingProvisionedWallet).not.toHaveBeenCalled()
  })

  it("clears the mark by wallet id, without needing the owner it was filed under", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValue(
      storedRecord({
        "custodial-1": "sc-wallet-1",
        "custodial-2": "sc-wallet-2",
      }),
    )
    /** The self-custodial session the heal runs from reports no owner at all. */
    mockOwnerId = null

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.clearPendingWallet("sc-wallet-1")
    })

    expect(mockClearPendingProvisionedWallet).toHaveBeenCalledWith(
      "migrationPendingAccounts_main",
      "sc-wallet-1",
    )
    expect(result.current.pendingAccountIds.has("sc-wallet-1")).toBe(false)
    /** Only the named wallet goes: another owner's pending wallet is untouched. */
    expect(result.current.pendingAccountIds.has("sc-wallet-2")).toBe(true)
  })

  /**
   * The mark gates deletion and `deleteWallet` re-reads it from storage, so a failed write
   * must leave the in-memory map saying what storage says. Reporting it gone would offer a
   * delete control that then refuses, silently.
   */
  it("keeps the mark in memory when clearing it by wallet id fails, and reports", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValue(
      storedRecord({
        "custodial-1": "sc-wallet-1",
      }),
    )
    mockClearPendingProvisionedWallet.mockRejectedValue(new Error("clear failed"))

    const { result } = renderHook(() => usePendingMigrationAccounts())
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

  it("throws instead of persisting when there is no owner, so provision aborts", async () => {
    mockActiveAccount = undefined
    mockOwnerId = null
    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(result.current.savePendingAccount("sc-new-1")).rejects.toThrow()
    expect(mockSavePendingProvisionedAccount).not.toHaveBeenCalled()
  })

  it("stops loading and reports when the pending map fails to load", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValue(failedRead)

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.pendingForActiveAccount).toBeNull()
    /** The cause travels, and the report is deduped: this read runs on every focus. */
    expect(mockReportError).toHaveBeenCalledWith(
      "Pending migration accounts load",
      expect.any(Error),
      { dedupKey: "pending-migration-accounts-unreadable" },
    )
    /** Surfaced, not swallowed: an unreadable record must stay distinguishable from
     *  "no pending wallet", or the gate reads a transient failure as a wiped device. */
    expect(result.current.hasError).toBe(true)
  })

  it("recovers through refetch after a failed load", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValueOnce(failedRead)
    mockReadPendingProvisionedAccounts.mockResolvedValue(
      storedRecord({
        "custodial-1": "sc-pending-1",
      }),
    )

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.hasError).toBe(false)
    expect(result.current.pendingForActiveAccount).toBe("sc-pending-1")
  })

  /** The error may only clear once the retry has SUCCEEDED: clearing it when the retry
   *  starts would present the still-empty map as settled data for the length of the
   *  read, and the gate would hand the user to support on it. */
  it("keeps hasError raised while a refetch is still in flight", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValueOnce(failedRead)

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    let resolveReload: (read: { status: string }) => void = () => {}
    mockReadPendingProvisionedAccounts.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReload = resolve
        }),
    )

    let refetchDone: Promise<void> | undefined
    act(() => {
      refetchDone = result.current.refetch()
    })
    expect(result.current.hasError).toBe(true)

    await act(async () => {
      resolveReload(storedRecord({}))
      await refetchDone
    })
    expect(result.current.hasError).toBe(false)
  })

  it("resolves instead of rejecting when the refetched load fails again", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValue(failedRead)

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    /** The gate's retry Promise.alls every refetch; a rejection there would double-report
     *  a failure that already traveled through reportError and hasError. */
    await act(async () => {
      await expect(result.current.refetch()).resolves.toBeUndefined()
    })
    expect(result.current.hasError).toBe(true)
  })

  /** A refetch that reads the mark of the now-active wallet is an ordinary success: the
   *  error clears and the mark stays, rather than leaving the gate stuck on retry. */
  it("clears hasError on a refetch that reads the active wallet's own mark", async () => {
    mockReadPendingProvisionedAccounts.mockResolvedValueOnce(failedRead)
    mockReadPendingProvisionedAccounts.mockResolvedValue(
      storedRecord({
        "custodial-1": "sc-wallet-1",
      }),
    )
    mockActiveAccount = { id: "sc-wallet-1", type: "selfCustodial" }

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.hasError).toBe(false)
    expect(result.current.pendingAccountIds.has("sc-wallet-1")).toBe(true)
  })

  it("propagates a failed write and records nothing, so provision aborts before creating the wallet", async () => {
    mockSavePendingProvisionedAccount.mockRejectedValue(new Error("save failed"))

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(result.current.savePendingAccount("sc-new-1")).rejects.toThrow(
      "save failed",
    )
    expect(result.current.pendingForActiveAccount).toBeNull()
  })

  it("drops a load that resolves after unmount", async () => {
    let resolveLoad: (value: Record<string, string>) => void = () => {}
    mockReadPendingProvisionedAccounts.mockReturnValue(
      new Promise<Record<string, string>>((resolve) => {
        resolveLoad = resolve
      }),
    )
    mockActiveAccount = { id: "sc-wallet-1", type: "selfCustodial" }

    const { result, unmount } = renderHook(() => usePendingMigrationAccounts())
    unmount()

    await act(async () => {
      resolveLoad({ owner: "sc-wallet-1" })
    })

    /** The late answer never lands: loading is still the initial true, so no consumer
     *  reads the resolved map as this mount's settled state. */
    expect(result.current.loading).toBe(true)
    expect(result.current.pendingAccountIds.size).toBe(0)
  })

  it("drops a load that rejects after unmount", async () => {
    let rejectLoad: (reason: Error) => void = () => {}
    mockReadPendingProvisionedAccounts.mockReturnValue(
      new Promise<Record<string, string>>((_resolve, reject) => {
        rejectLoad = reject
      }),
    )

    const { unmount } = renderHook(() => usePendingMigrationAccounts())
    unmount()

    await act(async () => {
      rejectLoad(new Error("read failed"))
    })

    /** The unexpected-throw path, which the strict read does not take: it reports the
     *  error as it comes, without the dedup key the answered failure carries. */
    expect(mockReportError).toHaveBeenCalledWith(
      "Pending migration accounts load",
      expect.any(Error),
    )
  })
})
