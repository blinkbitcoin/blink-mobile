import { renderHook, waitFor } from "@testing-library/react-native"

import {
  RecoveryBundleStatus,
  useRecoveryBundleStatus,
} from "@app/self-custodial/hooks/use-recovery-bundle-status"

const mockReadState = jest.fn()
jest.mock("@app/self-custodial/recovery-bundle/storage", () => ({
  readRecoveryBundleState: (...args: unknown[]) => mockReadState(...args),
}))

const mockReadSettings = jest.fn()
jest.mock("@app/self-custodial/recovery-bundle/settings", () => ({
  readRecoveryBundleSettings: (...args: unknown[]) => mockReadSettings(...args),
}))

const mockAccount = jest.fn()
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockAccount() }),
}))

const mockWallets = jest.fn()
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ wallets: mockWallets() }),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "mainnet",
}))

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: () => undefined,
}))

const SAVED_AT = Date.now() - 60_000
const btc = (amount: number) => [{ walletCurrency: "BTC", balance: { amount } }]

describe("useRecoveryBundleStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccount.mockReturnValue({ id: "account-1", type: "self-custodial" })
    mockWallets.mockReturnValue(btc(21000))
    mockReadState.mockResolvedValue({
      savedAt: SAVED_AT,
      totalSats: "21000",
      leafCount: 3,
      bundleCreatedAt: "2026-08-04T00:00:00Z",
      cloudSyncedAt: null,
    })
    mockReadSettings.mockResolvedValue({
      autoRefresh: true,
      cloudSync: false,
      exportedAt: Date.now(),
    })
  })

  it("says nothing on a custodial account", async () => {
    mockAccount.mockReturnValue({ id: "c", type: "custodial" })
    const { result } = renderHook(() => useRecoveryBundleStatus())
    await waitFor(() => expect(result.current.status).toBe(RecoveryBundleStatus.Unknown))
    expect(mockReadState).not.toHaveBeenCalled()
  })

  it("reports fresh while the wallet still matches the backup", async () => {
    const { result } = renderHook(() => useRecoveryBundleStatus())
    await waitFor(() => expect(result.current.status).toBe(RecoveryBundleStatus.Fresh))
    expect(result.current.leafCount).toBe(3)
  })

  it("reports stale once the balance has moved", async () => {
    // Money arrived after the snapshot: recovering from it now would leave the
    // new funds behind.
    mockWallets.mockReturnValue(btc(31000))
    const { result } = renderHook(() => useRecoveryBundleStatus())
    await waitFor(() => expect(result.current.status).toBe(RecoveryBundleStatus.Stale))
  })

  it("reports missing when no backup has been saved", async () => {
    mockReadState.mockResolvedValue(null)
    const { result } = renderHook(() => useRecoveryBundleStatus())
    await waitFor(() => expect(result.current.status).toBe(RecoveryBundleStatus.Missing))
  })

  it("reports missing when the stored state cannot be read", async () => {
    // "We cannot confirm you have one" reads as missing, not as fine.
    mockReadState.mockRejectedValue(new Error("corrupt"))
    const { result } = renderHook(() => useRecoveryBundleStatus())
    await waitFor(() => expect(result.current.status).toBe(RecoveryBundleStatus.Missing))
  })

  it("ignores a Dollar wallet when comparing balances", async () => {
    // Only Bitcoin is covered by on-chain recovery (R3), so a Dollar balance
    // must not make the Bitcoin backup look out of date.
    mockWallets.mockReturnValue([
      { walletCurrency: "USD", balance: { amount: 500 } },
      { walletCurrency: "BTC", balance: { amount: 21000 } },
    ])
    const { result } = renderHook(() => useRecoveryBundleStatus())
    await waitFor(() => expect(result.current.status).toBe(RecoveryBundleStatus.Fresh))
  })

  describe("only on this device", () => {
    it("flags a bundle that was never exported and never synced", async () => {
      mockReadSettings.mockResolvedValue({
        autoRefresh: true,
        cloudSync: false,
        exportedAt: null,
      })
      const { result } = renderHook(() => useRecoveryBundleStatus())
      await waitFor(() => expect(result.current.isOnlyOnThisDevice).toBe(true))
    })

    it("clears once the user has exported it", async () => {
      mockReadSettings.mockResolvedValue({
        autoRefresh: true,
        cloudSync: false,
        exportedAt: SAVED_AT,
      })
      const { result } = renderHook(() => useRecoveryBundleStatus())
      await waitFor(() => expect(result.current.isOnlyOnThisDevice).toBe(false))
    })

    it("clears once it has reached the cloud, even unexported", async () => {
      mockReadState.mockResolvedValue({
        savedAt: SAVED_AT,
        totalSats: "21000",
        leafCount: 3,
        bundleCreatedAt: "2026-08-04T00:00:00Z",
        cloudSyncedAt: SAVED_AT,
      })
      mockReadSettings.mockResolvedValue({
        autoRefresh: true,
        cloudSync: true,
        exportedAt: null,
      })
      const { result } = renderHook(() => useRecoveryBundleStatus())
      await waitFor(() => expect(result.current.isOnlyOnThisDevice).toBe(false))
    })

    it("is not claimed when there is no bundle at all", async () => {
      // Nothing exists, so "only on this device" would be a false statement;
      // that case is Missing.
      mockReadState.mockResolvedValue(null)
      mockReadSettings.mockResolvedValue({
        autoRefresh: true,
        cloudSync: false,
        exportedAt: null,
      })
      const { result } = renderHook(() => useRecoveryBundleStatus())
      await waitFor(() =>
        expect(result.current.status).toBe(RecoveryBundleStatus.Missing),
      )
      expect(result.current.isOnlyOnThisDevice).toBe(false)
    })
  })
})
