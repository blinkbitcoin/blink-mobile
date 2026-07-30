import { renderHook, waitFor } from "@testing-library/react-native"

import { useAnonStableBalanceDeactivation } from "@app/self-custodial/hooks/use-anon-stable-balance-deactivation"
import { ActiveWalletStatus } from "@app/types/wallet"

const mockDeactivateStableBalance = jest.fn()
jest.mock("@app/self-custodial/bridge", () => ({
  deactivateStableBalance: (...args: unknown[]) => mockDeactivateStableBalance(...args),
}))

let mockIsAnonMode = false
jest.mock("@app/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

const mockUseSelfCustodialWallet = jest.fn()
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
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
    mockDeactivateStableBalance.mockResolvedValue(undefined)
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
})
