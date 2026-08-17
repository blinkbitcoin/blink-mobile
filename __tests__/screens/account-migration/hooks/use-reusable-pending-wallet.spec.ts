import { renderHook } from "@testing-library/react-native"

import { useReusablePendingWallet } from "@app/screens/account-migration/hooks/use-reusable-pending-wallet"

let mockPendingForActiveAccount: string | null = null
let mockPendingLoading = false
let mockPendingHasError = false
const mockRefetchPending = jest.fn()
let mockRegistryAccounts: { id: string }[] = []
let mockRegistryLoading = false
const mockReloadSelfCustodialAccounts = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-pending-migration-accounts", () => ({
  usePendingMigrationAccounts: () => ({
    pendingForActiveAccount: mockPendingForActiveAccount,
    loading: mockPendingLoading,
    hasError: mockPendingHasError,
    refetch: mockRefetchPending,
  }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    accounts: mockRegistryAccounts,
    loading: mockRegistryLoading,
    reloadSelfCustodialAccounts: mockReloadSelfCustodialAccounts,
  }),
}))

describe("useReusablePendingWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPendingForActiveAccount = null
    mockPendingLoading = false
    mockPendingHasError = false
    mockRegistryAccounts = []
    mockRegistryLoading = false
    mockRefetchPending.mockResolvedValue(undefined)
    mockReloadSelfCustodialAccounts.mockResolvedValue(undefined)
  })

  it("returns the pending wallet when it still exists on the device", () => {
    mockPendingForActiveAccount = "sc-account-1"
    mockRegistryAccounts = [{ id: "custodial-1" }, { id: "sc-account-1" }]

    const { result } = renderHook(() => useReusablePendingWallet())

    expect(result.current.reusablePendingAccountId).toBe("sc-account-1")
  })

  it("returns null when the pending record survives but its wallet is gone", () => {
    mockPendingForActiveAccount = "sc-account-1"
    mockRegistryAccounts = [{ id: "custodial-1" }]

    const { result } = renderHook(() => useReusablePendingWallet())

    expect(result.current.reusablePendingAccountId).toBeNull()
  })

  it("returns null when no wallet is pending for the active account", () => {
    mockRegistryAccounts = [{ id: "custodial-1" }, { id: "sc-account-1" }]

    const { result } = renderHook(() => useReusablePendingWallet())

    expect(result.current.reusablePendingAccountId).toBeNull()
  })

  it("reports loading while the pending record is still being read", () => {
    mockPendingLoading = true

    const { result } = renderHook(() => useReusablePendingWallet())

    expect(result.current.loading).toBe(true)
  })

  it("reports loading while the account registry is still being read", () => {
    mockRegistryLoading = true

    const { result } = renderHook(() => useReusablePendingWallet())

    expect(result.current.loading).toBe(true)
  })

  it("settles to not loading once both sources have read", () => {
    const { result } = renderHook(() => useReusablePendingWallet())

    expect(result.current.loading).toBe(false)
  })

  /** The gate must not read a failed record read as "no wallet to reuse" — that is the
   *  wiped-device signature, and it ends at terminal support. */
  it("surfaces the pending record's read error", () => {
    mockPendingHasError = true

    const { result } = renderHook(() => useReusablePendingWallet())

    expect(result.current.hasError).toBe(true)
  })

  it("reloads both halves of the predicate on refetch", async () => {
    const { result } = renderHook(() => useReusablePendingWallet())

    await result.current.refetch()

    expect(mockRefetchPending).toHaveBeenCalledTimes(1)
    expect(mockReloadSelfCustodialAccounts).toHaveBeenCalledTimes(1)
  })
})
