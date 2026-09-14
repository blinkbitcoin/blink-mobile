import { renderHook, act } from "@testing-library/react-native"

import { useBackupNudgeState } from "@app/self-custodial/hooks/use-backup-nudge-state"

const mockBackupState = jest.fn()
const mockActiveWallet = jest.fn()
const mockRemoteConfig = jest.fn()
const mockAccountRegistry = jest.fn()
const mockMultiGet = jest.fn()
const mockSetItem = jest.fn()
const mockReportError = jest.fn()
const mockUseTotalBalance = jest.fn()

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  BackupStatus: { None: "none", Completed: "completed" },
  useBackupState: () => mockBackupState(),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockActiveWallet(),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockAccountRegistry(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockRemoteConfig(),
}))

const SATS_PER_USD_CENT = 10

jest.mock("@app/components/balance-header/use-total-balance", () => ({
  useTotalBalance: (wallets: Array<{ walletCurrency: string; balance: number }>) => {
    mockUseTotalBalance(wallets)
    return {
      satsBalance: wallets.reduce((sum, w) => {
        if (w.walletCurrency === "BTC") return sum + w.balance
        if (w.walletCurrency === "USD") return sum + w.balance * 10
        return sum
      }, 0),
    }
  },
}))

jest.mock("@react-native-async-storage/async-storage", () => ({
  multiGet: (keys: string[]) => mockMultiGet(keys),
  setItem: (...args: string[]) => mockSetItem(...args),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const ACCOUNT_ID = "test-self-custodial-uuid"
const BANNER_KEY = `backupNudgeDismissedAt:${ACCOUNT_ID}`
const MODAL_KEY = `backupNudgeModalDismissedAt:${ACCOUNT_ID}`

let storage: Record<string, string> = {}

// `multiGet` does NOT echo the requested key order on Android. The legacy module
// runs `SELECT key,value ... WHERE key IN (...)` with no ORDER BY, pushes the
// cursor rows first, then appends every key it did not find as [key, null].
// Reproducing that here keeps the suite honest about the platform we ship on.
const androidMultiGetOrder = (keys: string[]): [string, string | null][] => {
  const found = keys.filter((key) => storage[key] !== undefined)
  const missing = keys.filter((key) => storage[key] === undefined)
  return [
    ...found.map((key): [string, string | null] => [key, storage[key]]),
    ...missing.map((key): [string, string | null] => [key, null]),
  ]
}

const defaultBackupState = { backupState: { status: "none", method: null } }
const completedBackupState = { backupState: { status: "completed", method: "manual" } }
const selfCustodialWallet = {
  accountType: "self-custodial",
  isReady: true,
  wallets: [{ id: "btc-1", walletCurrency: "BTC", balance: { amount: 3000 } }],
}
const custodialWallet = {
  accountType: "custodial",
  isReady: true,
  wallets: [{ id: "btc-1", walletCurrency: "BTC", balance: { amount: 50000 } }],
}
const aboveModalThresholdWallet = {
  accountType: "self-custodial",
  isReady: true,
  wallets: [{ id: "btc-1", walletCurrency: "BTC", balance: { amount: 22000 } }],
}
const defaultConfig = {
  backupNudgeBannerThreshold: 2100,
  backupNudgeModalThreshold: 21000,
  backupNudgeModalCooldownMs: 24 * 60 * 60 * 1000,
}

const selfCustodialAccount = { type: "self-custodial", id: ACCOUNT_ID }

describe("useBackupNudgeState", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    storage = {}
    mockBackupState.mockReturnValue(defaultBackupState)
    mockActiveWallet.mockReturnValue(selfCustodialWallet)
    mockAccountRegistry.mockReturnValue({ activeAccount: selfCustodialAccount })
    mockRemoteConfig.mockReturnValue(defaultConfig)
    mockMultiGet.mockImplementation((keys: string[]) =>
      Promise.resolve(androidMultiGetOrder(keys)),
    )
    mockSetItem.mockResolvedValue(undefined)
  })

  it("hides banner and modal while dismissal-load is pending", () => {
    mockMultiGet.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useBackupNudgeState())

    expect(result.current.shouldShowBanner).toBe(false)
    expect(result.current.shouldShowModal).toBe(false)
  })

  it("shows settings banner without waiting for dismissal-load", () => {
    mockMultiGet.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useBackupNudgeState())

    expect(result.current.shouldShowSettingsBanner).toBe(true)
  })

  it("shows banner when balance >= banner threshold and not backed up", async () => {
    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowBanner).toBe(true)
    expect(result.current.shouldShowModal).toBe(false)
  })

  it("shows modal when balance >= modal threshold", async () => {
    mockActiveWallet.mockReturnValue(aboveModalThresholdWallet)

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowModal).toBe(true)
    expect(result.current.shouldShowBanner).toBe(false)
  })

  it("shows nothing when backed up", async () => {
    mockBackupState.mockReturnValue(completedBackupState)

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowBanner).toBe(false)
    expect(result.current.shouldShowModal).toBe(false)
    expect(result.current.shouldShowSettingsBanner).toBe(false)
  })

  it("shows nothing for custodial users", async () => {
    mockActiveWallet.mockReturnValue(custodialWallet)

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowBanner).toBe(false)
    expect(result.current.shouldShowModal).toBe(false)
  })

  it("shows settings banner for unbacked self-custodial", async () => {
    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowSettingsBanner).toBe(true)
  })

  it("dismisses banner and persists to AsyncStorage", async () => {
    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    act(() => {
      result.current.dismissBanner()
    })

    expect(result.current.shouldShowBanner).toBe(false)
    expect(mockSetItem).toHaveBeenCalledWith(BANNER_KEY, expect.any(String))
  })

  it("loads dismissed state from AsyncStorage", async () => {
    storage[BANNER_KEY] = String(Date.now())

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowBanner).toBe(false)
  })

  it("shows banner again after 24h cooldown", async () => {
    storage[BANNER_KEY] = String(Date.now() - 25 * 60 * 60 * 1000)

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowBanner).toBe(true)
  })

  it("dismisses the modal and persists it under its own key", async () => {
    mockActiveWallet.mockReturnValue(aboveModalThresholdWallet)

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})
    expect(result.current.shouldShowModal).toBe(true)

    act(() => {
      result.current.dismissModal()
    })

    expect(result.current.shouldShowModal).toBe(false)
    expect(mockSetItem).toHaveBeenCalledWith(MODAL_KEY, expect.any(String))
  })

  it("falls back to the banner once the modal is dismissed", async () => {
    mockActiveWallet.mockReturnValue(aboveModalThresholdWallet)

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})
    expect(result.current.shouldShowBanner).toBe(false)

    act(() => {
      result.current.dismissModal()
    })

    expect(result.current.shouldShowBanner).toBe(true)
  })

  it("keeps the modal dismissed across a remount within the cooldown", async () => {
    mockActiveWallet.mockReturnValue(aboveModalThresholdWallet)
    storage[MODAL_KEY] = String(Date.now())

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowModal).toBe(false)
    expect(result.current.shouldShowBanner).toBe(true)
  })

  it("keeps the modal dismissed when only the modal key exists (Android key order)", async () => {
    // The reported scenario: dismissed the modal, never dismissed the banner.
    // Android returns [[MODAL_KEY, ts], [BANNER_KEY, null]] - the reverse of the
    // request - so reading the reply positionally swaps the two timestamps and
    // brings the blocking modal back on every launch.
    mockActiveWallet.mockReturnValue(aboveModalThresholdWallet)
    storage[MODAL_KEY] = String(Date.now())

    expect(await mockMultiGet([BANNER_KEY, MODAL_KEY])).toEqual([
      [MODAL_KEY, expect.any(String)],
      [BANNER_KEY, null],
    ])

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowModal).toBe(false)
    expect(result.current.shouldShowBanner).toBe(true)
  })

  it("shows the modal again once its cooldown elapsed", async () => {
    mockActiveWallet.mockReturnValue(aboveModalThresholdWallet)
    storage[MODAL_KEY] = String(Date.now() - 25 * 60 * 60 * 1000)

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowModal).toBe(true)
  })

  it("honours the remote-config modal cooldown", async () => {
    mockActiveWallet.mockReturnValue(aboveModalThresholdWallet)
    mockRemoteConfig.mockReturnValue({
      ...defaultConfig,
      backupNudgeModalCooldownMs: 7 * 24 * 60 * 60 * 1000,
    })
    storage[MODAL_KEY] = String(Date.now() - 25 * 60 * 60 * 1000)

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowModal).toBe(false)
  })

  it("keeps the two dismissals independent", async () => {
    mockActiveWallet.mockReturnValue(aboveModalThresholdWallet)
    storage[BANNER_KEY] = String(Date.now())

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    // A dismissed banner must not silence the blocking modal...
    expect(result.current.shouldShowModal).toBe(true)

    act(() => {
      result.current.dismissModal()
    })

    // ...and dismissing the modal must not resurrect the dismissed banner.
    expect(result.current.shouldShowModal).toBe(false)
    expect(result.current.shouldShowBanner).toBe(false)
    // With both home-screen surfaces quiet, the settings banner is the warning
    // that has to remain - it is the only thing standing between this user and
    // no backup reminder at all.
    expect(result.current.shouldShowSettingsBanner).toBe(true)
  })

  it("fails open and reports when the dismissal read rejects", async () => {
    mockActiveWallet.mockReturnValue(aboveModalThresholdWallet)
    mockMultiGet.mockRejectedValue(new Error("SQLiteDiskIOException"))

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    // A storage failure must not silently suppress a security nudge.
    expect(result.current.shouldShowModal).toBe(true)
    expect(mockReportError).toHaveBeenCalledWith("Nudge dismiss read", expect.any(Error))
  })

  // A region gate hides the stable-token balance from the display, but the funds
  // are still on the device and still unbacked.
  it("measures the stable-token balance the region gate hides", async () => {
    mockActiveWallet.mockReturnValue({
      accountType: "self-custodial",
      isReady: true,
      wallets: [
        { id: "btc-1", walletCurrency: "BTC", balance: { amount: 3000 } },
        { id: "usd-1", walletCurrency: "USD", balance: { amount: 2000 } },
      ],
    })

    renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(mockUseTotalBalance).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ walletCurrency: "USD", balance: 2000 }),
      ]),
    )
  })

  it("reports a failed dismissal write", async () => {
    mockActiveWallet.mockReturnValue(aboveModalThresholdWallet)
    mockSetItem.mockRejectedValue(new Error("SQLiteFullException"))

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})
    await act(async () => {
      result.current.dismissModal()
    })

    expect(mockReportError).toHaveBeenCalledWith("Nudge dismiss write", expect.any(Error))
  })

  it("clears dismissal state and finishes loading for a custodial account", async () => {
    mockAccountRegistry.mockReturnValue({
      activeAccount: { type: "custodial", id: "custodial-uuid" },
    })

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    // No account-scoped key to read, so storage is never touched...
    expect(mockMultiGet).not.toHaveBeenCalled()
    // ...but `loaded` must still flip, or every threshold-gated surface stays
    // hidden forever. shouldShowBanner is the one that proves it: it is gated on
    // `loaded`, unlike shouldShowSettingsBanner.
    expect(result.current.shouldShowBanner).toBe(true)
  })

  it("ignores a stale read from the previously active account", async () => {
    const OTHER_ACCOUNT_ID = "other-self-custodial-uuid"
    mockActiveWallet.mockReturnValue(aboveModalThresholdWallet)

    // Account A dismissed its modal; account B has dismissed nothing.
    storage[MODAL_KEY] = String(Date.now())

    let landAccountARead: () => void = () => {}
    mockMultiGet.mockImplementationOnce(
      (keys: string[]) =>
        new Promise((resolve) => {
          landAccountARead = () => resolve(androidMultiGetOrder(keys))
        }),
    )

    const { result, rerender } = renderHook(() => useBackupNudgeState())

    // Switch to account B, whose read resolves straight away...
    mockAccountRegistry.mockReturnValue({
      activeAccount: { type: "self-custodial", id: OTHER_ACCOUNT_ID },
    })
    rerender({})
    await act(async () => {})

    expect(result.current.shouldShowModal).toBe(true)

    // ...and only now does account A's read land. Applying it would hide B's
    // modal using A's dismissal.
    await act(async () => {
      landAccountARead()
    })

    expect(result.current.shouldShowModal).toBe(true)
  })

  // Same race on the failure path: fail-open clears the dismissal state, so a
  // late rejection from the previous account would wipe the current account's
  // freshly loaded timestamps and re-show a modal it had already dismissed.
  it("ignores a stale failed read from the previously active account", async () => {
    const OTHER_ACCOUNT_ID = "other-self-custodial-uuid"
    mockActiveWallet.mockReturnValue(aboveModalThresholdWallet)

    let failAccountARead: () => void = () => {}
    mockMultiGet.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          failAccountARead = () => reject(new Error("SQLiteDiskIOException"))
        }),
    )

    const { result, rerender } = renderHook(() => useBackupNudgeState())

    // Account B loads cleanly and has a dismissed modal.
    storage[`backupNudgeModalDismissedAt:${OTHER_ACCOUNT_ID}`] = String(Date.now())
    mockAccountRegistry.mockReturnValue({
      activeAccount: { type: "self-custodial", id: OTHER_ACCOUNT_ID },
    })
    rerender({})
    await act(async () => {})

    expect(result.current.shouldShowModal).toBe(false)

    await act(async () => {
      failAccountARead()
    })

    expect(result.current.shouldShowModal).toBe(false)
  })

  // The keys are account-scoped, so with no self-custodial account there is no
  // key to write. Persisting anything here would land under a wrong or partial
  // key and silence a later account's nudge.
  it("never persists a dismissal without a self-custodial account", async () => {
    mockAccountRegistry.mockReturnValue({
      activeAccount: { type: "custodial", id: "custodial-uuid" },
    })

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})
    act(() => {
      result.current.dismissBanner()
      result.current.dismissModal()
    })

    expect(mockSetItem).not.toHaveBeenCalled()
  })

  it("triggers banner when USD weight pushes combined balance over the threshold", async () => {
    const btcAmount = 1_000
    const usdCentsAmount = 200
    const combinedSats = btcAmount + usdCentsAmount * SATS_PER_USD_CENT
    expect(btcAmount).toBeLessThan(defaultConfig.backupNudgeBannerThreshold)
    expect(combinedSats).toBeGreaterThanOrEqual(defaultConfig.backupNudgeBannerThreshold)

    mockActiveWallet.mockReturnValue({
      accountType: "self-custodial",
      isReady: true,
      wallets: [
        { id: "btc-1", walletCurrency: "BTC", balance: { amount: btcAmount } },
        { id: "usd-1", walletCurrency: "USD", balance: { amount: usdCentsAmount } },
      ],
    })

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowBanner).toBe(true)
  })

  it("triggers modal when USD weight pushes combined balance over the modal threshold", async () => {
    const btcAmount = 1_000
    const usdCentsAmount = 2_200
    const combinedSats = btcAmount + usdCentsAmount * SATS_PER_USD_CENT
    expect(btcAmount).toBeLessThan(defaultConfig.backupNudgeModalThreshold)
    expect(combinedSats).toBeGreaterThanOrEqual(defaultConfig.backupNudgeModalThreshold)

    mockActiveWallet.mockReturnValue({
      accountType: "self-custodial",
      isReady: true,
      wallets: [
        { id: "btc-1", walletCurrency: "BTC", balance: { amount: btcAmount } },
        { id: "usd-1", walletCurrency: "USD", balance: { amount: usdCentsAmount } },
      ],
    })

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowModal).toBe(true)
  })

  it("hides banner and modal while the active wallet is not ready (account switch in flight)", async () => {
    mockActiveWallet.mockReturnValue({
      accountType: "self-custodial",
      isReady: false,
      wallets: [{ id: "btc-1", walletCurrency: "BTC", balance: { amount: 22000 } }],
    })

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowBanner).toBe(false)
    expect(result.current.shouldShowModal).toBe(false)
  })
})
