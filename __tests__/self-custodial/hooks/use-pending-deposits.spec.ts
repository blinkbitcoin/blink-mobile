import { act, renderHook } from "@testing-library/react-native"

import { usePendingDeposits } from "@app/self-custodial/hooks"
import { DepositStatus, type PendingDeposit } from "@app/types/payment"
import { WalletCurrency } from "@app/graphql/generated"

const mockListPendingDeposits = jest.fn()
let mockListPendingDepositsImpl: typeof mockListPendingDeposits | undefined =
  mockListPendingDeposits
let mockWallets: unknown[] = []

/**
 * Stands in for a screen that is focused from mount onwards: react-navigation
 * runs the effect in a real useEffect and honours the cleanup it returns, so
 * the hook's generation guard is exercised the way it is in the app.
 */
jest.mock("@react-navigation/native", () => {
  const ReactActual = jest.requireActual("react")
  return {
    useFocusEffect: (effect: () => (() => void) | undefined) => {
      ReactActual.useEffect(effect, [effect])
    },
  }
})

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => ({ listPendingDeposits: mockListPendingDepositsImpl }),
}))

let mockActiveAccount: { id: string } | null = { id: "acct-1" }

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount }),
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
    mockActiveAccount = { id: "acct-1" }
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

  /** The adapter reports SDK failures as an empty list plus `errors`, so
   *  committing it would wipe the badge and the banner as if the deposit had
   *  confirmed. A pull that failed has to leave the screen as it was. */
  it("keeps the known deposits when the listing comes back with errors", async () => {
    mockListPendingDeposits.mockResolvedValue({ deposits: [deposit()] })

    const { result, rerender } = renderHook(() => usePendingDeposits())
    await flush()
    expect(result.current.deposits).toEqual([deposit()])

    mockListPendingDeposits.mockResolvedValue({
      deposits: [],
      errors: [{ message: "offline" }],
    })
    mockWallets = [{ id: "refreshed" }]
    rerender({})
    await flush()

    expect(result.current.deposits).toEqual([deposit()])
  })

  it("commits an empty list when the listing succeeds with no deposits", async () => {
    mockListPendingDeposits.mockResolvedValue({ deposits: [deposit()] })

    const { result, rerender } = renderHook(() => usePendingDeposits())
    await flush()

    mockListPendingDeposits.mockResolvedValue({ deposits: [], errors: [] })
    mockWallets = [{ id: "refreshed" }]
    rerender({})
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

  it("fetches once on mount (the focus effect owns the mount fetch)", async () => {
    mockListPendingDeposits.mockResolvedValue({ deposits: [] })

    renderHook(() => usePendingDeposits())
    await flush()

    expect(mockListPendingDeposits).toHaveBeenCalledTimes(1)
  })

  it("keeps the deposits through a same-account SDK teardown (transient adapter loss)", async () => {
    mockListPendingDeposits.mockResolvedValue({ deposits: [deposit()] })

    const { result, rerender } = renderHook(() => usePendingDeposits())
    await flush()
    expect(result.current.deposits).toEqual([deposit()])

    // Spark-network flip / manual retry: the lifecycle effect nulls the sdk and
    // empties the wallets while the SAME account reconnects.
    mockListPendingDepositsImpl = undefined
    mockWallets = []
    rerender({})
    await flush()

    expect(result.current.deposits).toEqual([deposit()])
  })

  it("clears the deposits when the active account changes", async () => {
    mockListPendingDeposits.mockResolvedValue({ deposits: [deposit()] })

    const { result, rerender } = renderHook(() => usePendingDeposits())
    await flush()
    expect(result.current.deposits).toEqual([deposit()])

    mockActiveAccount = { id: "acct-2" }
    mockListPendingDepositsImpl = undefined
    rerender({})
    await flush()

    expect(result.current.deposits).toEqual([])
  })

  it("ignores an in-flight listing that resolves after the adapter disappears", async () => {
    let resolveListing: (value: { deposits: PendingDeposit[] }) => void = () => {}
    mockListPendingDeposits.mockReturnValue(
      new Promise<{ deposits: PendingDeposit[] }>((resolve) => {
        resolveListing = resolve
      }),
    )

    const { result, rerender } = renderHook(() => usePendingDeposits())

    mockListPendingDepositsImpl = undefined
    rerender({})
    await flush()
    expect(result.current.deposits).toEqual([])

    act(() => {
      resolveListing({ deposits: [deposit()] })
    })
    await flush()

    expect(result.current.deposits).toEqual([])
  })

  it("exposes refetch, resolving after the fresh listing is committed", async () => {
    mockListPendingDeposits.mockResolvedValue({ deposits: [] })

    const { result } = renderHook(() => usePendingDeposits())
    await flush()

    mockListPendingDeposits.mockResolvedValue({ deposits: [deposit()] })
    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.deposits).toEqual([deposit()])
  })

  it("keeps the empty list's identity across an account change (no redundant commit)", async () => {
    mockListPendingDeposits.mockResolvedValue({ deposits: [] })

    const { result, rerender } = renderHook(() => usePendingDeposits())
    await flush()
    const empty = result.current.deposits

    mockActiveAccount = { id: "acct-2" }
    rerender({})
    await flush()

    expect(result.current.deposits).toBe(empty)
  })

  it("refetch converges on a superseding listing before resolving", async () => {
    mockListPendingDeposits.mockResolvedValue({ deposits: [] })

    const { result, rerender } = renderHook(() => usePendingDeposits())
    await flush()

    // First explicit refetch listing, deferred.
    let resolveFirst: (value: { deposits: PendingDeposit[] }) => void = () => {}
    mockListPendingDeposits.mockReturnValueOnce(
      new Promise<{ deposits: PendingDeposit[] }>((resolve) => {
        resolveFirst = resolve
      }),
    )
    // The superseding listing (fired by the wallets refresh), also deferred.
    let resolveSecond: (value: { deposits: PendingDeposit[] }) => void = () => {}
    mockListPendingDeposits.mockReturnValueOnce(
      new Promise<{ deposits: PendingDeposit[] }>((resolve) => {
        resolveSecond = resolve
      }),
    )

    let refetchSettled = false
    let refetchPromise: Promise<void> = Promise.resolve()
    act(() => {
      refetchPromise = result.current.refetch().then(() => {
        refetchSettled = true
      })
    })

    // A wallet refresh lands mid-listing and supersedes the refetch's fetch.
    mockWallets = [{ id: "refreshed" }]
    rerender({})
    await flush()

    act(() => {
      resolveFirst({ deposits: [deposit({ id: "stale:0", txid: "stale" })] })
    })
    await flush()
    // The superseded listing was discarded — refetch must keep waiting.
    expect(refetchSettled).toBe(false)
    expect(result.current.deposits).toEqual([])

    act(() => {
      resolveSecond({ deposits: [deposit()] })
    })
    await act(async () => {
      await refetchPromise
    })

    expect(refetchSettled).toBe(true)
    expect(result.current.deposits).toEqual([deposit()])
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
