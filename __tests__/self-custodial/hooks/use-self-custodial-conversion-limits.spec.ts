import { renderHook, waitFor } from "@testing-library/react-native"

import { ConvertDirection } from "@app/types/payment.types"

import { useSelfCustodialConversionLimits } from "@app/self-custodial/hooks/use-self-custodial-conversion-limits"

const mockFetchConversionLimits = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  fetchConversionLimits: (...args: unknown[]) => mockFetchConversionLimits(...args),
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

const mockSdk = { id: "sdk" }

describe("useSelfCustodialConversionLimits", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("stays in loading=true and skips fetches when sdk is null", () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })

    const { result } = renderHook(() => useSelfCustodialConversionLimits())

    expect(result.current).toEqual({
      btcToUsd: null,
      usdToBtc: null,
      loading: true,
      error: null,
    })
    expect(mockFetchConversionLimits).not.toHaveBeenCalled()
  })

  it("populates both directions on success", async () => {
    const btcToUsd = { minFromAmount: 1000, minToAmount: 50 }
    const usdToBtc = { minFromAmount: 25, minToAmount: 500 }
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: mockSdk })
    mockFetchConversionLimits
      .mockResolvedValueOnce(btcToUsd)
      .mockResolvedValueOnce(usdToBtc)

    const { result } = renderHook(() => useSelfCustodialConversionLimits())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.btcToUsd).toBe(btcToUsd)
    expect(result.current.usdToBtc).toBe(usdToBtc)
    expect(result.current.error).toBeNull()
    expect(mockFetchConversionLimits).toHaveBeenNthCalledWith(
      1,
      mockSdk,
      ConvertDirection.BtcToUsd,
    )
    expect(mockFetchConversionLimits).toHaveBeenNthCalledWith(
      2,
      mockSdk,
      ConvertDirection.UsdToBtc,
    )
  })

  it("captures the error and clears both directions when fetch fails", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: mockSdk })
    mockFetchConversionLimits.mockRejectedValue(new Error("limits unavailable"))

    const { result } = renderHook(() => useSelfCustodialConversionLimits())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.btcToUsd).toBeNull()
    expect(result.current.usdToBtc).toBeNull()
    expect(result.current.error?.message).toBe("limits unavailable")
  })
})
