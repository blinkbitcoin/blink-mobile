import { renderHook, waitFor } from "@testing-library/react-native"

import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import {
  useOnchainFeeTiers,
  SdkFeeError,
} from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers"

const mockPrepareSend = jest.fn()
const mockExtractOnchainFees = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  prepareSend: (...args: unknown[]) => mockPrepareSend(...args),
  extractOnchainFees: (...args: unknown[]) => mockExtractOnchainFees(...args),
}))

const mockSdk = { id: "mock-sdk" } as never

describe("useOnchainFeeTiers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns default tiers and no error when sdk is null", () => {
    const { result } = renderHook(() => useOnchainFeeTiers(null, "bc1qtest", 1000))

    expect(result.current.error).toBeNull()
    expect(result.current.tiers.fast.feeSats).toBe(0)
    expect(result.current.tiers.medium.feeSats).toBe(0)
    expect(result.current.tiers.slow.feeSats).toBe(0)
  })

  it("returns default tiers when address is undefined", () => {
    const { result } = renderHook(() => useOnchainFeeTiers(mockSdk, undefined, 1000))

    expect(result.current.error).toBeNull()
    expect(result.current.tiers.fast.feeSats).toBe(0)
  })

  it("returns default tiers when amountSats is undefined", () => {
    const { result } = renderHook(() =>
      useOnchainFeeTiers(mockSdk, "bc1qtest", undefined),
    )

    expect(result.current.error).toBeNull()
    expect(result.current.tiers.fast.feeSats).toBe(0)
  })

  it("fetches and sets fee tiers on success", async () => {
    const prepared = { id: "prepared" }
    mockPrepareSend.mockResolvedValue(prepared)
    mockExtractOnchainFees.mockReturnValue({ fast: 500, medium: 300, slow: 150 })

    const { result } = renderHook(() => useOnchainFeeTiers(mockSdk, "bc1qtest", 5000))

    await waitFor(() => {
      expect(result.current.tiers.fast.feeSats).toBe(500)
    })

    expect(result.current.tiers.medium.feeSats).toBe(300)
    expect(result.current.tiers.slow.feeSats).toBe(150)
    expect(result.current.error).toBeNull()
    expect(mockPrepareSend).toHaveBeenCalledWith(mockSdk, {
      paymentRequest: "bc1qtest",
      amount: BigInt(5000),
    })
  })

  it("sets ETA minutes for each tier", async () => {
    mockPrepareSend.mockResolvedValue({})
    mockExtractOnchainFees.mockReturnValue({ fast: 100, medium: 80, slow: 50 })

    const { result } = renderHook(() => useOnchainFeeTiers(mockSdk, "bc1qtest", 2000))

    await waitFor(() => {
      expect(result.current.tiers.fast.feeSats).toBe(100)
    })

    expect(result.current.tiers[FeeTierOption.Fast].etaMinutes).toBe(10)
    expect(result.current.tiers[FeeTierOption.Medium].etaMinutes).toBe(30)
    expect(result.current.tiers[FeeTierOption.Slow].etaMinutes).toBe(60)
  })

  it("classifies plain wrapped errors as Generic (no fragile message-string matching)", async () => {
    // After I1: a thrown Error whose .message happens to contain a tag name
    // does NOT short-circuit classification — only typed SdkError instances
    // do. Everything else collapses to Generic.
    mockPrepareSend.mockRejectedValue(new Error("SdkError.InsufficientFunds"))

    const { result } = renderHook(() => useOnchainFeeTiers(mockSdk, "bc1qtest", 5000))

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.Generic)
    })

    expect(result.current.tiers.fast.feeSats).toBe(0)
  })

  it("classifies typed SdkError instances by tag (prefers tag over message)", async () => {
    mockPrepareSend.mockRejectedValue({
      tag: "InsufficientFunds",
      message: "irrelevant message",
    })

    const { result } = renderHook(() => useOnchainFeeTiers(mockSdk, "bc1qtest", 1000))

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.InsufficientFunds)
    })
  })

  it("maps an unknown typed SdkError tag to Generic", async () => {
    mockPrepareSend.mockRejectedValue({ tag: "StorageError" })

    const { result } = renderHook(() => useOnchainFeeTiers(mockSdk, "bc1qtest", 1000))

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.Generic)
    })
  })

  it("classifies unknown errors as Generic", async () => {
    mockPrepareSend.mockRejectedValue(new Error("Something unexpected"))

    const { result } = renderHook(() => useOnchainFeeTiers(mockSdk, "bc1qtest", 1000))

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.Generic)
    })
  })

  it("surfaces Generic error when extractOnchainFees returns null (regression)", async () => {
    mockPrepareSend.mockResolvedValue({})
    mockExtractOnchainFees.mockReturnValue(null)

    const { result } = renderHook(() => useOnchainFeeTiers(mockSdk, "bc1qtest", 5000))

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.Generic)
    })

    expect(result.current.tiers.fast.feeSats).toBe(0)
    expect(result.current.tiers.medium.feeSats).toBe(0)
    expect(result.current.tiers.slow.feeSats).toBe(0)
  })

  it("classifies non-Error rejections as Generic", async () => {
    mockPrepareSend.mockRejectedValue("string error")

    const { result } = renderHook(() => useOnchainFeeTiers(mockSdk, "bc1qtest", 1000))

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.Generic)
    })
  })

  it("clears error on successful retry", async () => {
    mockPrepareSend.mockRejectedValue(new Error("transient"))

    const { result, rerender } = renderHook(
      ({ amount }) => useOnchainFeeTiers(mockSdk, "bc1qtest", amount),
      { initialProps: { amount: 100 as number | undefined } },
    )

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.Generic)
    })

    mockPrepareSend.mockResolvedValue({})
    mockExtractOnchainFees.mockReturnValue({ fast: 500, medium: 300, slow: 150 })

    rerender({ amount: 5000 })

    await waitFor(() => {
      expect(result.current.error).toBeNull()
    })

    expect(result.current.tiers.fast.feeSats).toBe(500)
  })

  it("clears error when amount becomes undefined", async () => {
    mockPrepareSend.mockRejectedValue(new Error("transient"))

    const { result, rerender } = renderHook(
      ({ amount }) => useOnchainFeeTiers(mockSdk, "bc1qtest", amount),
      { initialProps: { amount: 100 as number | undefined } },
    )

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.Generic)
    })

    rerender({ amount: undefined })

    await waitFor(() => {
      expect(result.current.error).toBeNull()
    })
  })

  it("ignores stale prepareSend resolutions when dependencies change mid-flight (regression)", async () => {
    let resolveStale: (value: unknown) => void = () => {}
    const stalePrepared = new Promise((resolve) => {
      resolveStale = resolve
    })
    // First call: never resolves until we explicitly trigger it.
    mockPrepareSend.mockImplementationOnce(() => stalePrepared)
    // Second call (after dep change): resolves immediately with fresh tiers.
    mockPrepareSend.mockResolvedValueOnce({ id: "fresh" })
    // The fresh call resolves first → consumes the first queued return value.
    // The stale call resolves later → consumes the second queued return value.
    mockExtractOnchainFees
      .mockReturnValueOnce({ fast: 100, medium: 80, slow: 50 }) // fresh tiers
      .mockReturnValueOnce({ fast: 999, medium: 999, slow: 999 }) // stale tiers

    const { result, rerender } = renderHook(
      ({ amount }) => useOnchainFeeTiers(mockSdk, "bc1qtest", amount),
      { initialProps: { amount: 1000 as number } },
    )

    // Trigger the dependency change while the first request is still pending.
    rerender({ amount: 5000 })

    await waitFor(() => {
      expect(result.current.tiers.fast.feeSats).toBe(100)
    })

    // Now resolve the stale request — it must NOT overwrite the fresh tiers.
    resolveStale({ id: "stale" })
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })

    expect(result.current.tiers.fast.feeSats).toBe(100)
    expect(result.current.tiers.fast.feeSats).not.toBe(999)
  })
})
