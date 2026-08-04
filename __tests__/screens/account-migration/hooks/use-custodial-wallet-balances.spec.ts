import { renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useCustodialWalletBalances } from "@app/screens/account-migration/hooks/use-custodial-wallet-balances"

const mockUseWalletOverviewScreenQuery = jest.fn()
let mockIsAuthed = true

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useWalletOverviewScreenQuery: (...args: unknown[]) =>
    mockUseWalletOverviewScreenQuery(...args),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => mockIsAuthed,
}))

const queryResult = (btcBalance: number, usdBalance: number) => ({
  data: {
    me: {
      defaultAccount: {
        wallets: [
          { id: "btc-1", walletCurrency: WalletCurrency.Btc, balance: btcBalance },
          { id: "usd-1", walletCurrency: WalletCurrency.Usd, balance: usdBalance },
        ],
      },
    },
  },
  loading: false,
  error: undefined,
  refetch: jest.fn(),
})

describe("useCustodialWalletBalances", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthed = true
    mockUseWalletOverviewScreenQuery.mockReturnValue(queryResult(1000, 500))
  })

  it("extracts the BTC/USD balances and wallet ids from the shared query", () => {
    const { result } = renderHook(() => useCustodialWalletBalances())

    expect(result.current.btcBalanceSats).toBe(1000)
    expect(result.current.usdBalanceCents).toBe(500)
    expect(result.current.walletIds).toEqual(["btc-1", "usd-1"])
    expect(result.current.isReady).toBe(true)
    expect(result.current.hasError).toBe(false)
  })

  it("defaults balances to zero but stays not-ready when the wallets are absent", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: { me: { defaultAccount: {} } },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    })

    const { result } = renderHook(() => useCustodialWalletBalances())

    expect(result.current.btcBalanceSats).toBe(0)
    expect(result.current.usdBalanceCents).toBe(0)
    /** wallets === undefined, so the zeros are unknown, not real: never present as ready. */
    expect(result.current.isReady).toBe(false)
  })

  it("stays not-ready while the query loads", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
      refetch: jest.fn(),
    })

    const { result } = renderHook(() => useCustodialWalletBalances())

    expect(result.current.loading).toBe(true)
    expect(result.current.isReady).toBe(false)
  })

  it("reports the error and stays not-ready when the query fails", () => {
    mockUseWalletOverviewScreenQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error("network"),
      refetch: jest.fn(),
    })

    const { result } = renderHook(() => useCustodialWalletBalances())

    expect(result.current.hasError).toBe(true)
    expect(result.current.isReady).toBe(false)
  })

  it("skips the query when unauthenticated", () => {
    mockIsAuthed = false

    renderHook(() => useCustodialWalletBalances())

    expect(mockUseWalletOverviewScreenQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("skips the query when skip is requested", () => {
    renderHook(() => useCustodialWalletBalances({ skip: true }))

    expect(mockUseWalletOverviewScreenQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    )
  })

  it("forwards the fetchPolicy override so the commit screen can read a fresh figure", () => {
    renderHook(() => useCustodialWalletBalances({ fetchPolicy: "cache-and-network" }))

    expect(mockUseWalletOverviewScreenQuery).toHaveBeenCalledWith(
      expect.objectContaining({ fetchPolicy: "cache-and-network" }),
    )
  })

  it("passes the query refetch through", () => {
    const refetch = jest.fn()
    mockUseWalletOverviewScreenQuery.mockReturnValue({ ...queryResult(1, 1), refetch })

    const { result } = renderHook(() => useCustodialWalletBalances())

    expect(result.current.refetch).toBe(refetch)
  })
})
