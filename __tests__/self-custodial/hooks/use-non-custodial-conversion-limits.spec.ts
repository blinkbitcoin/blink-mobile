import { renderHook, waitFor } from "@testing-library/react-native"

import { ConvertDirection } from "@app/types/payment.types"

import { useNonCustodialConversionLimits } from "@app/self-custodial/hooks/use-non-custodial-conversion-limits"

const mockFetchConversionLimits = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  fetchConversionLimits: (...args: unknown[]) => mockFetchConversionLimits(...args),
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

const fakeSdk = { id: "fake-sdk" }

describe("useNonCustodialConversionLimits", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: fakeSdk })
  })

  it("returns limits after successful fetch and forwards direction to the bridge", async () => {
    mockFetchConversionLimits.mockResolvedValue({
      minFromAmount: 1000,
      minToAmount: 500,
    })

    const { result } = renderHook(() =>
      useNonCustodialConversionLimits(ConvertDirection.BtcToUsd),
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.limits).toEqual({ minFromAmount: 1000, minToAmount: 500 })
    expect(result.current.error).toBeNull()
    expect(mockFetchConversionLimits).toHaveBeenCalledWith(
      fakeSdk,
      ConvertDirection.BtcToUsd,
    )
  })

  it("surfaces the error when fetchConversionLimits throws and clears limits", async () => {
    mockFetchConversionLimits.mockRejectedValue(new Error("network unreachable"))

    const { result } = renderHook(() =>
      useNonCustodialConversionLimits(ConvertDirection.UsdToBtc),
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.limits).toBeNull()
    expect(result.current.error?.message).toBe("network unreachable")
  })

  it("does not call the bridge when sdk is null", () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })

    const { result } = renderHook(() =>
      useNonCustodialConversionLimits(ConvertDirection.BtcToUsd),
    )

    expect(mockFetchConversionLimits).not.toHaveBeenCalled()
    expect(result.current.limits).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it("refetches when direction changes", async () => {
    mockFetchConversionLimits.mockResolvedValue({
      minFromAmount: 1,
      minToAmount: 1,
    })

    const { rerender } = renderHook(
      (direction: ConvertDirection) => useNonCustodialConversionLimits(direction),
      { initialProps: ConvertDirection.BtcToUsd as ConvertDirection },
    )

    await waitFor(() => {
      expect(mockFetchConversionLimits).toHaveBeenCalledWith(
        fakeSdk,
        ConvertDirection.BtcToUsd,
      )
    })

    rerender(ConvertDirection.UsdToBtc)

    await waitFor(() => {
      expect(mockFetchConversionLimits).toHaveBeenCalledWith(
        fakeSdk,
        ConvertDirection.UsdToBtc,
      )
    })

    expect(mockFetchConversionLimits).toHaveBeenCalledTimes(2)
  })
})
