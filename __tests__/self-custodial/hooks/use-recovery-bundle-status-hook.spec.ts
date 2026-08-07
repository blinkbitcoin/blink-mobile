import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { renderHook, act, waitFor } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import {
  RecoveryBundleStatus,
  useRecoveryBundleStatus,
} from "@app/self-custodial/hooks/use-recovery-bundle-status"
import { AccountStatus, AccountType } from "@app/types/wallet"

const ACCOUNT_ID = "test-self-custodial-uuid"

const mockUseAccountRegistry = jest.fn()
const mockUseActiveWallet = jest.fn()
const mockReadRecoveryBundleState = jest.fn()
const mockReadRecoveryBundleSettings = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockSparkNetwork.Regtest,
}))

jest.mock("@app/self-custodial/recovery-bundle/storage", () => ({
  readRecoveryBundleState: (...args: readonly unknown[]) =>
    mockReadRecoveryBundleState(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/settings", () => ({
  readRecoveryBundleSettings: (...args: readonly unknown[]) =>
    mockReadRecoveryBundleSettings(...args),
}))

// The production hook re-reads on focus; running the callback as a plain effect
// keeps that path exercised without a navigation container.
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest.requireActual<typeof import("react")>("react").useEffect(callback, [callback]),
}))

const selfCustodialAccount = {
  id: ACCOUNT_ID,
  type: AccountType.SelfCustodial,
  label: "Spark",
  selected: true,
  status: AccountStatus.Available,
}

const withBalance = (sats: number) =>
  mockUseActiveWallet.mockReturnValue({
    wallets: [
      {
        walletCurrency: WalletCurrency.Btc,
        balance: { amount: sats, currency: WalletCurrency.Btc },
      },
    ],
  })

const renderStatus = async () => {
  const rendered = renderHook(() => useRecoveryBundleStatus())
  await waitFor(() =>
    expect(rendered.result.current.status).not.toBe(RecoveryBundleStatus.Unknown),
  )
  return rendered
}

describe("useRecoveryBundleStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAccountRegistry.mockReturnValue({ activeAccount: selfCustodialAccount })
    withBalance(21000)
    mockReadRecoveryBundleState.mockResolvedValue({
      savedAt: Date.now() - 60_000,
      bundleCreatedAt: "2026-08-05T00:00:00Z",
      leafCount: 3,
      totalSats: "21000",
      cloudSyncedAt: null,
    })
    mockReadRecoveryBundleSettings.mockResolvedValue({
      autoRefresh: true,
      cloudSync: false,
      exportedAt: null,
    })
  })

  it("reports a bundle that matches the wallet as current", async () => {
    const { result } = await renderStatus()

    expect(result.current.status).toBe(RecoveryBundleStatus.Fresh)
    expect(result.current.leafCount).toBe(3)
  })

  it("reports a bundle the wallet has moved past as out of date", async () => {
    withBalance(30000)
    const { result } = await renderStatus()

    expect(result.current.status).toBe(RecoveryBundleStatus.Stale)
  })

  it("reports no bundle as missing", async () => {
    mockReadRecoveryBundleState.mockResolvedValue(null)
    const { result } = await renderStatus()

    expect(result.current.status).toBe(RecoveryBundleStatus.Missing)
    expect(result.current.savedAt).toBeNull()
  })

  it("reports an unreadable state file as missing", async () => {
    // "We cannot confirm you have a backup" and "you have no backup" call for
    // the same response from the user; claiming Fresh would not.
    mockReadRecoveryBundleState.mockRejectedValue(new Error("corrupt"))
    const { result } = await renderStatus()

    expect(result.current.status).toBe(RecoveryBundleStatus.Missing)
  })

  it("stays Unknown on a custodial account and reads nothing", async () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { ...selfCustodialAccount, type: AccountType.Custodial },
    })
    const { result } = renderHook(() => useRecoveryBundleStatus())

    await act(async () => {})

    expect(result.current.status).toBe(RecoveryBundleStatus.Unknown)
    expect(mockReadRecoveryBundleState).not.toHaveBeenCalled()
  })

  it("stays Unknown with no account at all", async () => {
    mockUseAccountRegistry.mockReturnValue({ activeAccount: null })
    const { result } = renderHook(() => useRecoveryBundleStatus())

    await act(async () => {})

    expect(result.current.status).toBe(RecoveryBundleStatus.Unknown)
  })

  it("ignores a Dollar wallet when comparing balances", async () => {
    // Only Bitcoin is covered by on-chain recovery (R3), so a Dollar balance
    // must not make the Bitcoin backup look out of date.
    mockUseActiveWallet.mockReturnValue({
      wallets: [
        {
          walletCurrency: WalletCurrency.Usd,
          balance: { amount: 500, currency: WalletCurrency.Usd },
        },
        {
          walletCurrency: WalletCurrency.Btc,
          balance: { amount: 21000, currency: WalletCurrency.Btc },
        },
      ],
    })
    const { result } = await renderStatus()

    expect(result.current.status).toBe(RecoveryBundleStatus.Fresh)
  })

  it("treats a wallet that has not loaded yet as having no balance to compare", async () => {
    mockUseActiveWallet.mockReturnValue({ wallets: [] })
    const { result } = await renderStatus()

    expect(result.current.status).toBe(RecoveryBundleStatus.Fresh)
  })

  describe("has the bundle left this device", () => {
    it("says no when it was never exported or synced", async () => {
      const { result } = await renderStatus()

      expect(result.current.isOnlyOnThisDevice).toBe(true)
    })

    it("says yes once the user exported it", async () => {
      mockReadRecoveryBundleSettings.mockResolvedValue({
        autoRefresh: true,
        cloudSync: false,
        exportedAt: Date.now(),
      })
      const { result } = await renderStatus()

      expect(result.current.isOnlyOnThisDevice).toBe(false)
    })

    it("says yes once it reached the cloud", async () => {
      mockReadRecoveryBundleState.mockResolvedValue({
        savedAt: Date.now() - 60_000,
        bundleCreatedAt: "2026-08-05T00:00:00Z",
        leafCount: 3,
        totalSats: "21000",
        cloudSyncedAt: Date.now(),
      })
      const { result } = await renderStatus()

      expect(result.current.isOnlyOnThisDevice).toBe(false)
    })

    it("does not ask the question when there is no bundle", async () => {
      // Missing already says everything; a second warning about where the
      // non-existent bundle lives would just be noise.
      mockReadRecoveryBundleState.mockResolvedValue(null)
      const { result } = await renderStatus()

      expect(result.current.isOnlyOnThisDevice).toBe(false)
    })
  })

  it("re-reads on demand", async () => {
    const { result } = await renderStatus()
    mockReadRecoveryBundleState.mockClear()

    await act(async () => {
      await result.current.reload()
    })

    expect(mockReadRecoveryBundleState).toHaveBeenCalledWith(
      ACCOUNT_ID,
      mockSparkNetwork.Regtest,
    )
  })
})
