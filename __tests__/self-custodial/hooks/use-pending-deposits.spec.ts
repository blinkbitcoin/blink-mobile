import { act, renderHook } from "@testing-library/react-native"

import { usePendingDeposits } from "@app/self-custodial/hooks"
import { DepositStatus, type PendingDeposit } from "@app/types/payment"
import { WalletCurrency } from "@app/graphql/generated"

const mockListPendingDeposits = jest.fn()
let mockListPendingDepositsImpl: typeof mockListPendingDeposits | undefined =
  mockListPendingDeposits
let mockWallets: unknown[] = []

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: () => void) => {
    cb()
  },
}))

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => ({ listPendingDeposits: mockListPendingDepositsImpl }),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ wallets: mockWallets }),
}))

const deposit = (overrides: Partial<PendingDeposit> = {}): PendingDeposit => ({
  id: "abc:0",
  txid: "abc",
  vout: 0,
  amount: { amount: 5_000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  status: DepositStatus.Immature,
  errorReason: null,
  ...overrides,
})

const flush = () =>
  act(async () => {
    await Promise.resolve()
  })

describe("usePendingDeposits", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListPendingDepositsImpl = mockListPendingDeposits
    mockWallets = []
  })

  it("returns the fetched deposits", async () => {
    mockListPendingDeposits.mockResolvedValue({ deposits: [deposit()] })

    const { result } = renderHook(() => usePendingDeposits())
    await flush()

    expect(result.current.deposits).toEqual([deposit()])
  })

  it("no-ops without a listPendingDeposits adapter (custodial / loading)", async () => {
    mockListPendingDepositsImpl = undefined

    const { result } = renderHook(() => usePendingDeposits())
    await flush()

    expect(result.current.deposits).toEqual([])
  })

  it("keeps the same array identity when a refetch returns an unchanged list", async () => {
    mockListPendingDeposits.mockImplementation(() =>
      // A fresh array each call: only the identity guard can keep state stable.
      Promise.resolve({ deposits: [deposit()] }),
    )

    const { result, rerender } = renderHook(() => usePendingDeposits())
    await flush()
    const first = result.current.deposits

    mockWallets = [{ id: "refreshed" }] // wallet refresh triggers a refetch
    rerender({})
    await flush()

    expect(result.current.deposits).toEqual([deposit()])
    expect(result.current.deposits).toBe(first)
  })

  it("commits a status-only change so Immature -> Claimable propagates", async () => {
    mockListPendingDeposits.mockResolvedValue({
      deposits: [deposit({ status: DepositStatus.Immature })],
    })

    const { result, rerender } = renderHook(() => usePendingDeposits())
    await flush()
    expect(result.current.deposits[0].status).toBe(DepositStatus.Immature)

    mockListPendingDeposits.mockResolvedValue({
      deposits: [deposit({ status: DepositStatus.Claimable })],
    })
    mockWallets = [{ id: "refreshed" }]
    rerender({})
    await flush()

    expect(result.current.deposits[0].status).toBe(DepositStatus.Claimable)
  })

  it("ignores a stale fetch that resolves after a newer one started", async () => {
    let resolveStale: (value: { deposits: PendingDeposit[] }) => void = () => {}
    const stale = new Promise<{ deposits: PendingDeposit[] }>((resolve) => {
      resolveStale = resolve
    })
    mockListPendingDeposits.mockReturnValue(stale)

    const { result, rerender } = renderHook(() => usePendingDeposits())

    mockListPendingDeposits.mockResolvedValue({
      deposits: [deposit({ id: "fresh:0", txid: "fresh" })],
    })
    mockWallets = [{ id: "refreshed" }]
    rerender({})
    await flush()
    expect(result.current.deposits[0]?.id).toBe("fresh:0")

    act(() => {
      resolveStale({ deposits: [deposit({ id: "stale:0", txid: "stale" })] })
    })
    await flush()

    expect(result.current.deposits[0]?.id).toBe("fresh:0")
  })
})
