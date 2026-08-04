import { renderHook } from "@testing-library/react-native"

import { useReusablePendingWallet } from "@app/screens/account-migration/hooks/use-reusable-pending-wallet"

let mockPendingForActiveAccount: string | null = null
let mockPendingLoading = false
let mockRegistryAccounts: { id: string }[] = []
let mockRegistryLoading = false

jest.mock("@app/screens/account-migration/hooks/use-pending-migration-accounts", () => ({
  usePendingMigrationAccounts: () => ({
    pendingForActiveAccount: mockPendingForActiveAccount,
    loading: mockPendingLoading,
  }),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    accounts: mockRegistryAccounts,
    loading: mockRegistryLoading,
  }),
}))

describe("useReusablePendingWallet", () => {
  beforeEach(() => {
    mockPendingForActiveAccount = null
    mockPendingLoading = false
    mockRegistryAccounts = []
    mockRegistryLoading = false
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
})
