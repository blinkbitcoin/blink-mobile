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

  it("classifies InsufficientFunds error", async () => {
    mockPrepareSend.mockRejectedValue(new Error("SdkError.InsufficientFunds"))

    const { result } = renderHook(() => useOnchainFeeTiers(mockSdk, "bc1qtest", 5000))

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.InsufficientFunds)
    })

    expect(result.current.tiers.fast.feeSats).toBe(0)
  })

  it("classifies InvalidInput error", async () => {
    mockPrepareSend.mockRejectedValue(new Error("SdkError.InvalidInput"))

    const { result } = renderHook(() => useOnchainFeeTiers(mockSdk, "bc1qtest", 100))

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.InvalidInput)
    })
  })

  it("classifies NetworkError", async () => {
    mockPrepareSend.mockRejectedValue(new Error("SdkError.NetworkError"))

    const { result } = renderHook(() => useOnchainFeeTiers(mockSdk, "bc1qtest", 1000))

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.NetworkError)
    })
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

  it("surfaces Generic error when extractOnchainFees returns null (regression Critical #3)", async () => {
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
    mockPrepareSend.mockRejectedValue(new Error("SdkError.InvalidInput"))

    const { result, rerender } = renderHook(
      ({ amount }) => useOnchainFeeTiers(mockSdk, "bc1qtest", amount),
      { initialProps: { amount: 100 as number | undefined } },
    )

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.InvalidInput)
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
    mockPrepareSend.mockRejectedValue(new Error("SdkError.InvalidInput"))

    const { result, rerender } = renderHook(
      ({ amount }) => useOnchainFeeTiers(mockSdk, "bc1qtest", amount),
      { initialProps: { amount: 100 as number | undefined } },
    )

    await waitFor(() => {
      expect(result.current.error).toBe(SdkFeeError.InvalidInput)
    })

    rerender({ amount: undefined })

    await waitFor(() => {
      expect(result.current.error).toBeNull()
    })
  })
})
