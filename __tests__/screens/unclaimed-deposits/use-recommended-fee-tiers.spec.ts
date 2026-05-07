import { renderHook, waitFor } from "@testing-library/react-native"

import { SdkFeeError } from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers"
import { useRecommendedFeeTiers } from "@app/screens/unclaimed-deposits/hooks/use-recommended-fee-tiers"
import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"

const mockGetRecommendedFees = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  getRecommendedFees: (...args: unknown[]) => mockGetRecommendedFees(...args),
}))

const mockSdk = {} as never

describe("useRecommendedFeeTiers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns null error and zero default tiers while disabled", async () => {
    const { result } = renderHook(() => useRecommendedFeeTiers(mockSdk, false))

    await waitFor(() => expect(result.current.error).toBeNull())
    expect(result.current.tiers[FeeTierOption.Fast].feeSats).toBe(0)
    expect(mockGetRecommendedFees).not.toHaveBeenCalled()
  })

  it("populates tiers when fetch succeeds", async () => {
    mockGetRecommendedFees.mockResolvedValue({
      fastest: 30,
      halfHour: 20,
      hour: 15,
      economy: 10,
      minimum: 5,
    })

    const { result } = renderHook(() => useRecommendedFeeTiers(mockSdk, true))

    await waitFor(() => expect(result.current.tiers[FeeTierOption.Fast].feeSats).toBe(30))
    expect(result.current.tiers[FeeTierOption.Medium].feeSats).toBe(20)
    expect(result.current.tiers[FeeTierOption.Slow].feeSats).toBe(10)
    expect(result.current.error).toBeNull()
  })

  it("surfaces error when fetch rejects (no longer silent)", async () => {
    mockGetRecommendedFees.mockRejectedValue(new Error("Network request failed"))

    const { result } = renderHook(() => useRecommendedFeeTiers(mockSdk, true))

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(Object.values(SdkFeeError)).toContain(result.current.error)
  })

  it("keeps tiers at zero defaults when fetch rejects (caller can detect)", async () => {
    mockGetRecommendedFees.mockRejectedValue(new Error("boom"))

    const { result } = renderHook(() => useRecommendedFeeTiers(mockSdk, true))

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.tiers[FeeTierOption.Fast].feeSats).toBe(0)
    expect(result.current.tiers[FeeTierOption.Medium].feeSats).toBe(0)
    expect(result.current.tiers[FeeTierOption.Slow].feeSats).toBe(0)
  })

  it("clears error on successful retry after a previous failure", async () => {
    mockGetRecommendedFees.mockRejectedValueOnce(new Error("transient"))
    mockGetRecommendedFees.mockResolvedValueOnce({
      fastest: 25,
      halfHour: 15,
      hour: 10,
      economy: 8,
      minimum: 4,
    })

    const { result, rerender } = renderHook(
      ({ enabled }) => useRecommendedFeeTiers(mockSdk, enabled),
      { initialProps: { enabled: true } },
    )

    await waitFor(() => expect(result.current.error).not.toBeNull())

    // Re-mount the effect by toggling enabled and back.
    rerender({ enabled: false })
    rerender({ enabled: true })

    await waitFor(() => expect(result.current.tiers[FeeTierOption.Fast].feeSats).toBe(25))
    expect(result.current.error).toBeNull()
  })
})
