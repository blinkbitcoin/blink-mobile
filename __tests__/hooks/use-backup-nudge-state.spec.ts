import { renderHook, act } from "@testing-library/react-native"

import { useBackupNudgeState } from "@app/hooks/use-backup-nudge-state"

const mockBackupState = jest.fn()
const mockActiveWallet = jest.fn()
const mockRemoteConfig = jest.fn()
const mockGetItem = jest.fn()
const mockSetItem = jest.fn()

jest.mock("@app/self-custodial/providers/backup-state-provider", () => ({
  BackupStatus: { None: "none", Completed: "completed" },
  useBackupState: () => mockBackupState(),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockActiveWallet(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockRemoteConfig(),
}))

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: string[]) => mockGetItem(...args),
  setItem: (...args: string[]) => mockSetItem(...args),
}))

const defaultBackupState = { backupState: { status: "none", method: null } }
const completedBackupState = { backupState: { status: "completed", method: "manual" } }
const selfCustodialWallet = {
  accountType: "self-custodial",
  wallets: [{ walletCurrency: "BTC", balance: { amount: 3000 } }],
}
const custodialWallet = {
  accountType: "custodial",
  wallets: [{ walletCurrency: "BTC", balance: { amount: 50000 } }],
}
const defaultConfig = {
  backupNudgeBannerThreshold: 2100,
  backupNudgeModalThreshold: 21000,
}

describe("useBackupNudgeState", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBackupState.mockReturnValue(defaultBackupState)
    mockActiveWallet.mockReturnValue(selfCustodialWallet)
    mockRemoteConfig.mockReturnValue(defaultConfig)
    mockGetItem.mockResolvedValue(null)
    mockSetItem.mockResolvedValue(undefined)
  })

  it("hides banner and modal while dismissal-load is pending", () => {
    mockGetItem.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useBackupNudgeState())

    expect(result.current.shouldShowBanner).toBe(false)
    expect(result.current.shouldShowModal).toBe(false)
  })

  it("shows settings banner without waiting for dismissal-load", () => {
    mockGetItem.mockReturnValue(new Promise(() => {}))

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
    mockActiveWallet.mockReturnValue({
      accountType: "self-custodial",
      wallets: [{ walletCurrency: "BTC", balance: { amount: 22000 } }],
    })

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
    expect(mockSetItem).toHaveBeenCalledWith("backupNudgeDismissedAt", expect.any(String))
  })

  it("loads dismissed state from AsyncStorage", async () => {
    mockGetItem.mockResolvedValue(String(Date.now()))

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowBanner).toBe(false)
  })

  it("shows banner again after 24h cooldown", async () => {
    mockGetItem.mockResolvedValue(String(Date.now() - 25 * 60 * 60 * 1000))

    const { result } = renderHook(() => useBackupNudgeState())

    await act(async () => {})

    expect(result.current.shouldShowBanner).toBe(true)
  })
})
