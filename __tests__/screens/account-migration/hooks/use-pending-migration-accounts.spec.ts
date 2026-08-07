import { act, renderHook, waitFor } from "@testing-library/react-native"

import { usePendingMigrationAccounts } from "@app/screens/account-migration/hooks/use-pending-migration-accounts"

const mockLoadPendingProvisionedAccounts = jest.fn()
const mockSavePendingProvisionedAccount = jest.fn()
const mockClearPendingProvisionedAccount = jest.fn()
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
    mockOwnerId = "custodial-1"
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

  /** Two custodial profiles on one device each key by their own Galoy account id, so one
   *  profile never sees the other's provisioned wallet. */
  it("keeps each custodial profile's pending wallet separate", async () => {
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-1": "sc-pending-1",
      "custodial-2": "sc-pending-2",
    })
    mockOwnerId = "custodial-2"

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.pendingForActiveAccount).toBe("sc-pending-2")
  })

  /** A cleanup write lost to a crash leaves a record hiding the now-active wallet; on
   *  load it is dropped so the funded wallet never vanishes from the switcher. */
  it("self-heals a record whose wallet is already the active account", async () => {
    mockLoadPendingProvisionedAccounts.mockResolvedValue({ "custodial-1": "sc-wallet-1" })
    mockActiveAccount = { id: "sc-wallet-1", type: "selfCustodial" }

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.pendingAccountIds.has("sc-wallet-1")).toBe(false)
    expect(mockClearPendingProvisionedAccount).toHaveBeenCalledWith(
      "migrationPendingAccounts_main",
      "custodial-1",
    )
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

  it("stops loading and reports when the pending map fails to load", async () => {
    mockLoadPendingProvisionedAccounts.mockRejectedValue(new Error("read failed"))

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.pendingForActiveAccount).toBeNull()
    expect(mockReportError).toHaveBeenCalledWith(
      "Pending migration accounts load",
      expect.any(Error),
    )
    /** Surfaced, not swallowed: an unreadable record must stay distinguishable from
     *  "no pending wallet", or the gate reads a transient failure as a wiped device. */
    expect(result.current.hasError).toBe(true)
  })

  it("recovers through refetch after a failed load", async () => {
    mockLoadPendingProvisionedAccounts.mockRejectedValueOnce(new Error("read failed"))
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-1": "sc-pending-1",
    })

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
    mockLoadPendingProvisionedAccounts.mockRejectedValueOnce(new Error("read failed"))

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    let resolveReload: (pending: Record<string, string>) => void = () => {}
    mockLoadPendingProvisionedAccounts.mockImplementation(
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
      resolveReload({})
      await refetchDone
    })
    expect(result.current.hasError).toBe(false)
  })

  it("resolves instead of rejecting when the refetched load fails again", async () => {
    mockLoadPendingProvisionedAccounts.mockRejectedValue(new Error("read failed"))

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    /** The gate's retry Promise.alls every refetch; a rejection there would double-report
     *  a failure that already traveled through reportError and hasError. */
    await act(async () => {
      await expect(result.current.refetch()).resolves.toBeUndefined()
    })
    expect(result.current.hasError).toBe(true)
  })

  /** The record itself was read fine in the self-heal case, so it counts as a success
   *  and clears a raised error rather than leaving the gate stuck on retry. */
  it("clears hasError when a refetch lands on the self-heal path", async () => {
    mockLoadPendingProvisionedAccounts.mockRejectedValueOnce(new Error("read failed"))
    mockLoadPendingProvisionedAccounts.mockResolvedValue({
      "custodial-1": "sc-wallet-1",
    })
    mockActiveAccount = { id: "sc-wallet-1", type: "selfCustodial" }

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.hasError).toBe(false)
    expect(result.current.pendingForActiveAccount).toBeNull()
  })

  it("reports when the self-heal cleanup write fails", async () => {
    mockLoadPendingProvisionedAccounts.mockResolvedValue({ "custodial-1": "sc-wallet-1" })
    mockActiveAccount = { id: "sc-wallet-1", type: "selfCustodial" }
    mockClearPendingProvisionedAccount.mockRejectedValue(new Error("clear failed"))

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await waitFor(() =>
      expect(mockReportError).toHaveBeenCalledWith(
        "Pending migration account self-heal",
        expect.any(Error),
      ),
    )
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

  it("reports when clearing a pending wallet fails", async () => {
    mockClearPendingProvisionedAccount.mockRejectedValue(new Error("clear failed"))

    const { result } = renderHook(() => usePendingMigrationAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.clearPendingAccount("custodial-1")
    })

    expect(mockReportError).toHaveBeenCalledWith(
      "Pending migration account clear",
      expect.any(Error),
    )
  })

  it("drops a load that resolves after unmount", async () => {
    let resolveLoad: (value: Record<string, string>) => void = () => {}
    mockLoadPendingProvisionedAccounts.mockReturnValue(
      new Promise<Record<string, string>>((resolve) => {
        resolveLoad = resolve
      }),
    )
    mockActiveAccount = { id: "sc-wallet-1", type: "selfCustodial" }

    const { unmount } = renderHook(() => usePendingMigrationAccounts())
    unmount()

    await act(async () => {
      resolveLoad({ owner: "sc-wallet-1" })
    })

    expect(mockClearPendingProvisionedAccount).not.toHaveBeenCalled()
  })

  it("drops a load that rejects after unmount", async () => {
    let rejectLoad: (reason: Error) => void = () => {}
    mockLoadPendingProvisionedAccounts.mockReturnValue(
      new Promise<Record<string, string>>((_resolve, reject) => {
        rejectLoad = reject
      }),
    )

    const { unmount } = renderHook(() => usePendingMigrationAccounts())
    unmount()

    await act(async () => {
      rejectLoad(new Error("read failed"))
    })

    expect(mockReportError).toHaveBeenCalledWith(
      "Pending migration accounts load",
      expect.any(Error),
    )
  })
})
