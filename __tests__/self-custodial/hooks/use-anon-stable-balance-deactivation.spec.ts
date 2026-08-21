import { renderHook, waitFor } from "@testing-library/react-native"

import { flushEffects } from "../../helpers/flush-effects"

import { useAnonStableBalanceDeactivation } from "@app/self-custodial/hooks/use-anon-stable-balance-deactivation"
import { isStableBalanceAnonPaused } from "@app/store/persistent-state/stable-balance-anon-pause"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { ActiveWalletStatus } from "@app/types/wallet"

const mockDeactivateStableBalance = jest.fn()
const mockActivateStableBalance = jest.fn()
jest.mock("@app/self-custodial/bridge", () => ({
  deactivateStableBalance: (...args: unknown[]) => mockDeactivateStableBalance(...args),
  activateStableBalance: (...args: unknown[]) => mockActivateStableBalance(...args),
}))

let mockPersistentState: PersistentState = {
  schemaVersion: 20,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
  activeAccountId: "sc-1",
}
const mockUpdateState = jest.fn()
jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

let mockIsAnonMode = false
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

const mockUseSelfCustodialWallet = jest.fn()
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

let mockStableBalanceEnabled = true
jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({ stableBalanceEnabled: mockStableBalanceEnabled }),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const sdk = { id: "sdk" }
const mockRefreshStableBalanceActive = jest.fn()

const usdWallet = (amount: number) => ({
  id: "usd-1",
  walletCurrency: "USD",
  balance: { amount, currency: "USD", currencyCode: "USD" },
})

const setupWallet = (
  overrides: Partial<{
    sdk: typeof sdk | null
    isStableBalanceActive: boolean
    status: ActiveWalletStatus
    wallets: unknown[]
  }> = {},
) => {
  mockUseSelfCustodialWallet.mockReturnValue({
    sdk,
    isStableBalanceActive: true,
    status: ActiveWalletStatus.Ready,
    wallets: [usdWallet(0)],
    refreshStableBalanceActive: mockRefreshStableBalanceActive,
    ...overrides,
  })
}

describe("useAnonStableBalanceDeactivation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAnonMode = true
    mockStableBalanceEnabled = true
    mockPersistentState = {
      schemaVersion: 20,
      galoyInstance: { id: "Main" },
      galoyAuthToken: "",
      activeAccountId: "sc-1",
    }
    mockDeactivateStableBalance.mockResolvedValue(undefined)
    mockActivateStableBalance.mockResolvedValue(undefined)
    mockRefreshStableBalanceActive.mockResolvedValue(undefined)
  })

  it("deactivates the stable balance in Anon with a settled empty dollar balance", async () => {
    setupWallet()

    renderHook(() => useAnonStableBalanceDeactivation())

    await waitFor(() => {
      expect(mockDeactivateStableBalance).toHaveBeenCalledWith(sdk)
    })
    await waitFor(() => {
      expect(mockRefreshStableBalanceActive).toHaveBeenCalledTimes(1)
    })
  })

  it("does nothing outside Anon Mode", async () => {
    mockIsAnonMode = false
    setupWallet()

    renderHook(() => useAnonStableBalanceDeactivation())
    await Promise.resolve()

    expect(mockDeactivateStableBalance).not.toHaveBeenCalled()
  })

  it("does nothing when the stable balance is already inactive", async () => {
    setupWallet({ isStableBalanceActive: false })

    renderHook(() => useAnonStableBalanceDeactivation())
    await Promise.resolve()

    expect(mockDeactivateStableBalance).not.toHaveBeenCalled()
  })

  it("leaves a remaining dollar balance alone", async () => {
    setupWallet({ wallets: [usdWallet(500)] })

    renderHook(() => useAnonStableBalanceDeactivation())
    await Promise.resolve()

    expect(mockDeactivateStableBalance).not.toHaveBeenCalled()
  })

  it("waits for the balance to settle before trusting a zero", async () => {
    setupWallet({ status: ActiveWalletStatus.Loading, wallets: [] })

    renderHook(() => useAnonStableBalanceDeactivation())
    await Promise.resolve()

    expect(mockDeactivateStableBalance).not.toHaveBeenCalled()
  })

  it("treats a degraded wallet as settled", async () => {
    setupWallet({ status: ActiveWalletStatus.Degraded })

    renderHook(() => useAnonStableBalanceDeactivation())

    await waitFor(() => {
      expect(mockDeactivateStableBalance).toHaveBeenCalledWith(sdk)
    })
  })

  it("does nothing without a connected SDK", async () => {
    setupWallet({ sdk: null })

    renderHook(() => useAnonStableBalanceDeactivation())
    await Promise.resolve()

    expect(mockDeactivateStableBalance).not.toHaveBeenCalled()
  })

  it("reports a failed deactivation without refreshing", async () => {
    const failure = new Error("deactivate failed")
    mockDeactivateStableBalance.mockRejectedValue(failure)
    setupWallet()

    renderHook(() => useAnonStableBalanceDeactivation())

    await waitFor(() => {
      expect(mockReportError).toHaveBeenCalledWith(
        "anon stable balance deactivation",
        failure,
      )
    })
    expect(mockRefreshStableBalanceActive).not.toHaveBeenCalled()
  })

  it("records the drop against the account so leaving Anon can undo it", async () => {
    setupWallet()

    renderHook(() => useAnonStableBalanceDeactivation())

    await waitFor(() => expect(mockUpdateState).toHaveBeenCalledTimes(1))

    const updater = mockUpdateState.mock.calls[0][0]
    expect(isStableBalanceAnonPaused(updater(mockPersistentState), "sc-1")).toBe(true)
    expect(updater(undefined)).toBeUndefined()
  })

  describe("leaving Anon Mode", () => {
    const setupPausedByAnon = () => {
      mockIsAnonMode = false
      mockPersistentState = {
        ...mockPersistentState,
        stableBalanceAnonPausedByAccountId: { "sc-1": true },
      }
      setupWallet({ isStableBalanceActive: false })
    }

    /**
     * The wallet provider reports `stableBalanceEnabled && sdkStableBalanceActive`, so a flag
     * switched off while the user sat in Anon reads exactly like a user who had turned the
     * feature off. Reactivating on that would switch a disabled feature back on.
     */
    it("does not reactivate once the remote flag has been switched off", async () => {
      setupPausedByAnon()
      mockStableBalanceEnabled = false

      renderHook(() => useAnonStableBalanceDeactivation())
      await flushEffects()

      expect(mockActivateStableBalance).not.toHaveBeenCalled()
    })

    /** The marker survives, so the reactivation still owes the user their setting back if
     *  the flag returns. */
    it("keeps the marker while the flag is off, so a returning flag still restores it", async () => {
      setupPausedByAnon()
      mockStableBalanceEnabled = false

      renderHook(() => useAnonStableBalanceDeactivation())
      await flushEffects()

      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("puts back the stable balance Anon switched off", async () => {
      setupPausedByAnon()

      renderHook(() => useAnonStableBalanceDeactivation())

      await waitFor(() => expect(mockActivateStableBalance).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(mockRefreshStableBalanceActive).toHaveBeenCalledTimes(1))
    })

    it("clears the marker so it never reactivates twice", async () => {
      setupPausedByAnon()

      renderHook(() => useAnonStableBalanceDeactivation())

      await waitFor(() => expect(mockUpdateState).toHaveBeenCalledTimes(1))

      const updater = mockUpdateState.mock.calls[0][0]
      expect(isStableBalanceAnonPaused(updater(mockPersistentState), "sc-1")).toBe(false)
    })

    /** A user who switched it off themselves left no marker, so nothing may switch it
     *  back on behind them: activating sweeps their bitcoin and charges a fee. */
    it("leaves an unmarked account alone", async () => {
      mockIsAnonMode = false
      setupWallet({ isStableBalanceActive: false })

      renderHook(() => useAnonStableBalanceDeactivation())
      await Promise.resolve()

      expect(mockActivateStableBalance).not.toHaveBeenCalled()
    })

    it("does not reactivate while the mode is still Anon", async () => {
      mockPersistentState = {
        ...mockPersistentState,
        stableBalanceAnonPausedByAccountId: { "sc-1": true },
      }
      setupWallet({ isStableBalanceActive: false })

      renderHook(() => useAnonStableBalanceDeactivation())
      await Promise.resolve()

      expect(mockActivateStableBalance).not.toHaveBeenCalled()
    })

    it("waits for the balance to settle before reactivating", async () => {
      setupPausedByAnon()
      setupWallet({ isStableBalanceActive: false, status: ActiveWalletStatus.Loading })

      renderHook(() => useAnonStableBalanceDeactivation())
      await Promise.resolve()

      expect(mockActivateStableBalance).not.toHaveBeenCalled()
    })

    it("reports a failed reactivation instead of clearing the marker", async () => {
      setupPausedByAnon()
      mockActivateStableBalance.mockRejectedValue(new Error("sdk down"))

      renderHook(() => useAnonStableBalanceDeactivation())

      await waitFor(() =>
        expect(mockReportError).toHaveBeenCalledWith(
          "anon stable balance reactivation",
          expect.any(Error),
        ),
      )
      expect(mockUpdateState).not.toHaveBeenCalled()
    })
  })
})
