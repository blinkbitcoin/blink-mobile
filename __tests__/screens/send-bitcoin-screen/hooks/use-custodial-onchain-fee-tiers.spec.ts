import { renderHook, waitFor } from "@testing-library/react-native"

import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import { OnchainFeeQuote } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { useCustodialOnchainFeeTiers } from "@app/screens/send-bitcoin-screen/hooks/use-custodial-onchain-fee-tiers"

const mockFetchBtcFees = jest.fn()
const mockFetchUsdFees = jest.fn()
const mockFetchUsdAsBtcFees = jest.fn()

/**
 * Apollo hands back a stable execute function across renders. These stand-ins must be
 * stable too: a fresh identity per render would re-arm the hook's effect forever.
 */
jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useOnChainTxFeeBySpeedLazyQuery: () => [mockFetchBtcFees],
    useOnChainUsdTxFeeBySpeedLazyQuery: () => [mockFetchUsdFees],
    useOnChainUsdTxFeeAsBtcDenominatedBySpeedLazyQuery: () => [mockFetchUsdAsBtcFees],
  }
})

const feeResponse = (fast: number, medium: number, slow: number) => ({
  data: {
    fast: { amount: fast },
    medium: { amount: medium },
    slow: { amount: slow },
  },
})

const btcParams = {
  walletId: "btc-wallet",
  address: "bc1qtest",
  amount: 50_000,
  quote: OnchainFeeQuote.Btc,
}

describe("useCustodialOnchainFeeTiers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns zeroed tiers and no error before an amount is set", () => {
    const { result } = renderHook(() =>
      useCustodialOnchainFeeTiers({ ...btcParams, amount: undefined }),
    )

    expect(result.current.hasError).toBe(false)
    expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(0)
    expect(result.current.tiers[FeeTierOption.Medium].feeAmount).toBe(0)
    expect(result.current.tiers[FeeTierOption.Slow].feeAmount).toBe(0)
    expect(mockFetchBtcFees).not.toHaveBeenCalled()
  })

  it("does not quote without a wallet, an address or a quote variant", () => {
    renderHook(() => useCustodialOnchainFeeTiers({ ...btcParams, walletId: undefined }))
    renderHook(() => useCustodialOnchainFeeTiers({ ...btcParams, address: undefined }))
    renderHook(() => useCustodialOnchainFeeTiers({ ...btcParams, quote: undefined }))

    expect(mockFetchBtcFees).not.toHaveBeenCalled()
  })

  it("carries the backend payout windows as each tier eta", () => {
    const { result } = renderHook(() =>
      useCustodialOnchainFeeTiers({ ...btcParams, amount: undefined }),
    )

    expect(result.current.tiers[FeeTierOption.Fast].etaMinutes).toBe(10)
    expect(result.current.tiers[FeeTierOption.Medium].etaMinutes).toBe(60)
    expect(result.current.tiers[FeeTierOption.Slow].etaMinutes).toBe(1440)
  })

  it("quotes a btc wallet through the sats query and maps every tier", async () => {
    mockFetchBtcFees.mockResolvedValue(feeResponse(900, 600, 300))

    const { result } = renderHook(() => useCustodialOnchainFeeTiers(btcParams))

    await waitFor(() => {
      expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(900)
    })

    expect(result.current.tiers[FeeTierOption.Medium].feeAmount).toBe(600)
    expect(result.current.tiers[FeeTierOption.Slow].feeAmount).toBe(300)
    expect(result.current.hasError).toBe(false)
    expect(mockFetchBtcFees).toHaveBeenCalledWith({
      variables: { walletId: "btc-wallet", address: "bc1qtest", amount: 50_000 },
    })
    expect(mockFetchUsdFees).not.toHaveBeenCalled()
    expect(mockFetchUsdAsBtcFees).not.toHaveBeenCalled()
  })

  it("quotes a usd wallet through the cents query", async () => {
    mockFetchUsdFees.mockResolvedValue(feeResponse(50, 30, 20))

    const { result } = renderHook(() =>
      useCustodialOnchainFeeTiers({
        walletId: "usd-wallet",
        address: "bc1qtest",
        amount: 250,
        quote: OnchainFeeQuote.Usd,
      }),
    )

    await waitFor(() => {
      expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(50)
    })

    expect(mockFetchUsdFees).toHaveBeenCalledWith({
      variables: { walletId: "usd-wallet", address: "bc1qtest", amount: 250 },
    })
    expect(mockFetchBtcFees).not.toHaveBeenCalled()
  })

  it("quotes a usd wallet as-btc-denominated when the destination fixed the amount", async () => {
    mockFetchUsdAsBtcFees.mockResolvedValue(feeResponse(70, 40, 25))

    const { result } = renderHook(() =>
      useCustodialOnchainFeeTiers({
        walletId: "usd-wallet",
        address: "bc1qtest",
        amount: 50_000,
        quote: OnchainFeeQuote.UsdAsBtcDenominated,
      }),
    )

    await waitFor(() => {
      expect(result.current.tiers[FeeTierOption.Slow].feeAmount).toBe(25)
    })

    expect(mockFetchUsdAsBtcFees).toHaveBeenCalledWith({
      variables: { walletId: "usd-wallet", address: "bc1qtest", amount: 50_000 },
    })
    expect(mockFetchUsdFees).not.toHaveBeenCalled()
  })

  it("flags an error and zeroes the tiers when the quote rejects", async () => {
    mockFetchBtcFees.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() => useCustodialOnchainFeeTiers(btcParams))

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })

    expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(0)
    expect(result.current.tiers[FeeTierOption.Slow].feeAmount).toBe(0)
  })

  it("flags an error when the response carries no data", async () => {
    mockFetchBtcFees.mockResolvedValue({ data: undefined })

    const { result } = renderHook(() => useCustodialOnchainFeeTiers(btcParams))

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })
  })

  it("clears a previous error once a later quote succeeds", async () => {
    mockFetchBtcFees.mockRejectedValueOnce(new Error("network down"))

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useCustodialOnchainFeeTiers>[0]) =>
        useCustodialOnchainFeeTiers(props),
      { initialProps: btcParams },
    )

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })

    mockFetchBtcFees.mockResolvedValue(feeResponse(900, 600, 300))
    rerender({ ...btcParams, amount: 60_000 })

    await waitFor(() => {
      expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(900)
    })
    expect(result.current.hasError).toBe(false)
  })

  it("drops the previous amount's fees while the next quote is in flight", async () => {
    mockFetchBtcFees.mockResolvedValueOnce(feeResponse(900, 600, 300))

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useCustodialOnchainFeeTiers>[0]) =>
        useCustodialOnchainFeeTiers(props),
      { initialProps: btcParams },
    )

    await waitFor(() => {
      expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(900)
    })
    expect(result.current.isQuoting).toBe(false)

    // A quote that never settles keeps the hook in flight for the assertion.
    mockFetchBtcFees.mockImplementationOnce(
      () =>
        new Promise(() => {
          // deliberately never resolves
        }),
    )
    rerender({ ...btcParams, amount: 99_000 })

    await waitFor(() => {
      expect(result.current.isQuoting).toBe(true)
    })
    // Pairing 900 with the new amount would misstate the fee, so it is dropped.
    expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(0)
  })

  it("stops quoting once the response lands", async () => {
    mockFetchBtcFees.mockResolvedValue(feeResponse(900, 600, 300))

    const { result } = renderHook(() => useCustodialOnchainFeeTiers(btcParams))

    await waitFor(() => {
      expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(900)
    })
    expect(result.current.isQuoting).toBe(false)
  })

  it("stops quoting when the request fails", async () => {
    mockFetchBtcFees.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() => useCustodialOnchainFeeTiers(btcParams))

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })
    expect(result.current.isQuoting).toBe(false)
  })

  it("quotes from the very first render when the params are already in hand", () => {
    mockFetchBtcFees.mockImplementation(
      () =>
        new Promise(() => {
          // deliberately never resolves
        }),
    )

    const { result } = renderHook(() => useCustodialOnchainFeeTiers(btcParams))

    // Read before any effect flush: false here would paint bare tier names with no spinner.
    expect(result.current.isQuoting).toBe(true)
  })

  it("is not quoting on first render when a param is missing", () => {
    const { result } = renderHook(() =>
      useCustodialOnchainFeeTiers({ ...btcParams, amount: undefined }),
    )

    expect(result.current.isQuoting).toBe(false)
  })

  it("never quotes without the params it needs", async () => {
    const { result } = renderHook(() =>
      useCustodialOnchainFeeTiers({ ...btcParams, amount: undefined }),
    )

    await waitFor(() => {
      expect(result.current.isQuoting).toBe(false)
    })
  })

  it("drops a previous failure as soon as the next quote starts, not when it lands", async () => {
    mockFetchBtcFees.mockRejectedValueOnce(new Error("network down"))

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useCustodialOnchainFeeTiers>[0]) =>
        useCustodialOnchainFeeTiers(props),
      { initialProps: btcParams },
    )

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })

    // A quote that never settles: the error must still clear the moment it is fired.
    mockFetchBtcFees.mockImplementationOnce(
      () =>
        new Promise(() => {
          // deliberately never resolves
        }),
    )
    rerender({ ...btcParams, amount: 60_000 })

    await waitFor(() => {
      expect(result.current.hasError).toBe(false)
    })
  })

  it("does not surface a stale failure once a newer quote already succeeded", async () => {
    let rejectStale: ((reason: unknown) => void) | undefined
    mockFetchBtcFees.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectStale = reject
        }),
    )
    mockFetchBtcFees.mockResolvedValue(feeResponse(111, 222, 333))

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useCustodialOnchainFeeTiers>[0]) =>
        useCustodialOnchainFeeTiers(props),
      { initialProps: btcParams },
    )

    rerender({ ...btcParams, amount: 99_000 })

    await waitFor(() => {
      expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(111)
    })

    rejectStale?.(new Error("stale request failed"))

    await waitFor(() => {
      expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(111)
    })
    expect(result.current.hasError).toBe(false)
  })

  it("discards a stale quote when the amount changes mid-flight", async () => {
    let resolveStale: ((value: unknown) => void) | undefined
    mockFetchBtcFees.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve
        }),
    )
    mockFetchBtcFees.mockResolvedValue(feeResponse(111, 222, 333))

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useCustodialOnchainFeeTiers>[0]) =>
        useCustodialOnchainFeeTiers(props),
      { initialProps: btcParams },
    )

    rerender({ ...btcParams, amount: 99_000 })

    await waitFor(() => {
      expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(111)
    })

    resolveStale?.(feeResponse(999, 999, 999))

    await waitFor(() => {
      expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(111)
    })
    expect(result.current.tiers[FeeTierOption.Fast].feeAmount).not.toBe(999)
  })
})
