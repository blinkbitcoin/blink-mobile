import { it } from "@jest/globals"
import { act, renderHook } from "@testing-library/react-native"

import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import {
  useOnchainFeeTiers,
  SdkFeeError,
} from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers"

const mockPrepareSend = jest.fn()
const mockExtractOnchainFees = jest.fn()
const mockReportError = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  prepareSend: (...args: unknown[]) => mockPrepareSend(...args),
  extractOnchainFees: (...args: unknown[]) => mockExtractOnchainFees(...args),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const mockSdk = { id: "mock-sdk" } as never

const FEES = { fast: 300, medium: 200, slow: 100 }

type HookProps = { amount: number | undefined }

const renderTiers = (amount: number | undefined = 5000) =>
  renderHook(({ amount }: HookProps) => useOnchainFeeTiers(mockSdk, "bc1qtest", amount), {
    initialProps: { amount },
  })

const deferred = <T>() => {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("useOnchainFeeTiers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExtractOnchainFees.mockReturnValue(FEES)
  })

  it("never quotes on its own, whatever the amount does", async () => {
    const { rerender } = renderTiers(1)
    rerender({ amount: 15 })
    rerender({ amount: 150 })
    await act(async () => {})

    // Each SDK quote reserves the wallet's funds, so one per keystroke had them fight.
    expect(mockPrepareSend).not.toHaveBeenCalled()
  })

  it("holds no quote and no error until asked", () => {
    const { result } = renderTiers()

    expect(result.current.hasQuote).toBe(false)
    expect(result.current.isQuoting).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(0)
    expect(result.current.tiers[FeeTierOption.Fast].etaMinutes).toBe(10)
    expect(result.current.tiers[FeeTierOption.Medium].etaMinutes).toBe(30)
    expect(result.current.tiers[FeeTierOption.Slow].etaMinutes).toBe(60)
  })

  it("quotes once when asked and hands back the tiers", async () => {
    mockPrepareSend.mockResolvedValue({})
    const { result } = renderTiers()

    let tiers: unknown
    await act(async () => {
      tiers = await result.current.quote()
    })

    expect(mockPrepareSend).toHaveBeenCalledTimes(1)
    expect(mockPrepareSend).toHaveBeenCalledWith(mockSdk, {
      paymentRequest: "bc1qtest",
      amount: BigInt(5000),
    })
    expect(tiers).toEqual(result.current.tiers)
    expect(result.current.hasQuote).toBe(true)
    expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(300)
    expect(result.current.tiers[FeeTierOption.Medium].feeAmount).toBe(200)
    expect(result.current.tiers[FeeTierOption.Slow].feeAmount).toBe(100)
  })

  it("resolves null without calling the SDK when there is nothing to quote", async () => {
    const { result } = renderHook(() => useOnchainFeeTiers(null, "bc1qtest", 1000))

    let tiers: unknown = "unset"
    await act(async () => {
      tiers = await result.current.quote()
    })

    expect(tiers).toBeNull()
    expect(mockPrepareSend).not.toHaveBeenCalled()
  })

  it("is quoting only while the request is out", async () => {
    const request = deferred<object>()
    mockPrepareSend.mockReturnValue(request.promise)
    const { result } = renderTiers()

    let pending: Promise<unknown> = Promise.resolve()
    act(() => {
      pending = result.current.quote()
    })
    expect(result.current.isQuoting).toBe(true)

    await act(async () => {
      request.resolve({})
      await pending
    })
    expect(result.current.isQuoting).toBe(false)
  })

  it("shares one request between two presses for the same amount", async () => {
    const request = deferred<object>()
    mockPrepareSend.mockReturnValue(request.promise)
    const { result } = renderTiers()

    let first: Promise<unknown> = Promise.resolve()
    let second: Promise<unknown> = Promise.resolve()
    act(() => {
      first = result.current.quote()
      second = result.current.quote()
    })

    await act(async () => {
      request.resolve({})
      await Promise.all([first, second])
    })

    expect(mockPrepareSend).toHaveBeenCalledTimes(1)
  })

  it("drops an answer for an amount that changed while it was out", async () => {
    const request = deferred<object>()
    mockPrepareSend.mockReturnValue(request.promise)
    const { result, rerender } = renderTiers(5000)

    let pending: Promise<unknown> = Promise.resolve()
    act(() => {
      pending = result.current.quote()
    })
    rerender({ amount: 6000 })

    let tiers: unknown = "unset"
    await act(async () => {
      request.resolve({})
      tiers = await pending
    })

    // Navigating with it would send 5000 sats under a screen that reads 6000.
    expect(tiers).toBeNull()
    expect(result.current.hasQuote).toBe(false)
  })

  it("drops the quote once the amount changes", async () => {
    mockPrepareSend.mockResolvedValue({})
    const { result, rerender } = renderTiers(5000)
    await act(async () => {
      await result.current.quote()
    })
    expect(result.current.hasQuote).toBe(true)

    rerender({ amount: 6000 })

    expect(result.current.hasQuote).toBe(false)
    expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(0)
  })

  it("keeps a failure for its amount only", async () => {
    mockPrepareSend.mockRejectedValue({ tag: "InsufficientFunds" })
    const { result, rerender } = renderTiers(5000)

    let tiers: unknown = "unset"
    await act(async () => {
      tiers = await result.current.quote()
    })
    expect(tiers).toBeNull()
    expect(result.current.error).toBe(SdkFeeError.InsufficientFunds)

    rerender({ amount: 6000 })
    expect(result.current.error).toBeNull()
  })

  it("does not bring an error back when its amount is retyped", async () => {
    mockPrepareSend.mockRejectedValue({ tag: "InvalidInput" })
    const { result, rerender } = renderTiers(5000)
    await act(async () => {
      await result.current.quote()
    })
    expect(result.current.error).toBe(SdkFeeError.InvalidInput)

    rerender({ amount: 50000 })
    rerender({ amount: 5000 })

    // Only Next asks again; until then the amount on screen has no verdict.
    expect(result.current.error).toBeNull()
  })

  it("does not bring a quote back when its amount is retyped", async () => {
    mockPrepareSend.mockResolvedValue({})
    const { result, rerender } = renderTiers(5000)
    await act(async () => {
      await result.current.quote()
    })

    rerender({ amount: 6000 })
    rerender({ amount: 5000 })

    expect(result.current.hasQuote).toBe(false)
  })

  it("clears the error when a retry succeeds", async () => {
    mockPrepareSend.mockRejectedValueOnce(new Error("transient")).mockResolvedValue({})
    const { result } = renderTiers()

    await act(async () => {
      await result.current.quote()
    })
    expect(result.current.error).toBe(SdkFeeError.Generic)

    await act(async () => {
      await result.current.quote()
    })
    expect(result.current.error).toBeNull()
    expect(result.current.hasQuote).toBe(true)
  })

  it("reports the SDK's own error, flagging the ones the sender fixes as expected", async () => {
    const generic = new Error("Failed to select leaves after all retries")
    mockPrepareSend.mockRejectedValueOnce(generic)
    const { result } = renderTiers()
    await act(async () => {
      await result.current.quote()
    })
    expect(mockReportError).toHaveBeenCalledWith(
      "Self-custodial onchain fee quote",
      generic,
      {
        expected: false,
      },
    )

    const tooLow = { tag: "InvalidInput" }
    mockPrepareSend.mockRejectedValueOnce(tooLow)
    await act(async () => {
      await result.current.quote()
    })
    expect(mockReportError).toHaveBeenLastCalledWith(
      "Self-custodial onchain fee quote",
      tooLow,
      { expected: true },
    )
  })

  it.each([
    [
      "a plain Error naming a tag",
      new Error("SdkError.InsufficientFunds"),
      SdkFeeError.Generic,
    ],
    [
      "a typed InsufficientFunds",
      { tag: "InsufficientFunds", message: "x" },
      SdkFeeError.InsufficientFunds,
    ],
    ["a typed InvalidInput", { tag: "InvalidInput" }, SdkFeeError.InvalidInput],
    ["a typed NetworkError", { tag: "NetworkError" }, SdkFeeError.NetworkError],
    ["an unmapped typed tag", { tag: "SparkError" }, SdkFeeError.Generic],
    ["a non-Error rejection", "string error", SdkFeeError.Generic],
  ])("classifies %s", async (_label, rejection, expected) => {
    mockPrepareSend.mockRejectedValue(rejection)
    const { result } = renderTiers()

    await act(async () => {
      await result.current.quote()
    })

    expect(result.current.error).toBe(expected)
    expect(result.current.hasQuote).toBe(false)
  })

  it("fails as Generic when the SDK answers without an on-chain quote", async () => {
    mockPrepareSend.mockResolvedValue({})
    mockExtractOnchainFees.mockReturnValue(null)
    const { result } = renderTiers()

    let tiers: unknown = "unset"
    await act(async () => {
      tiers = await result.current.quote()
    })

    expect(tiers).toBeNull()
    expect(result.current.error).toBe(SdkFeeError.Generic)
    expect(result.current.tiers[FeeTierOption.Fast].feeAmount).toBe(0)
  })
})
