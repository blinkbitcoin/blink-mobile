import { fetchConversionLimits } from "@app/self-custodial/bridge/limits"
import { ConvertDirection } from "@app/types/payment"

const mockRequireTokenId = jest.fn(() => "usdb-token-id")

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: {},
  requireSparkTokenIdentifier: () => mockRequireTokenId(),
}))

const mockGetInfo = jest.fn().mockResolvedValue({
  tokenBalances: {
    usdb: {
      balance: BigInt(0),
      tokenMetadata: {
        identifier: "usdb-token-id",
        ticker: "USDB",
        decimals: 6,
      },
    },
  },
})

describe("fetchConversionLimits", () => {
  it("calls sdk.fetchConversionLimits with FromBitcoin and leaves sat-denominated minFromAmount unchanged", async () => {
    const fetchConversionLimitsFn = jest.fn().mockResolvedValue({
      minFromAmount: BigInt(1000),
      minToAmount: BigInt(500000),
    })

    const result = await fetchConversionLimits(
      {
        fetchConversionLimits: fetchConversionLimitsFn,
        getInfo: mockGetInfo,
      } as never,
      ConvertDirection.BtcToUsd,
    )

    expect(fetchConversionLimitsFn).toHaveBeenCalledWith({
      conversionType: { tag: "FromBitcoin" },
      tokenIdentifier: "usdb-token-id",
    })
    // minFromAmount stays as sats; minToAmount converts token base units → cents.
    expect(result).toEqual({ minFromAmount: 1000, minToAmount: 50 })
  })

  it("calls sdk.fetchConversionLimits with ToBitcoin and normalizes token-denominated minFromAmount to cents", async () => {
    const fetchConversionLimitsFn = jest.fn().mockResolvedValue({
      minFromAmount: BigInt(500000),
      minToAmount: BigInt(800),
    })

    const result = await fetchConversionLimits(
      {
        fetchConversionLimits: fetchConversionLimitsFn,
        getInfo: mockGetInfo,
      } as never,
      ConvertDirection.UsdToBtc,
    )

    expect(fetchConversionLimitsFn).toHaveBeenCalledWith({
      conversionType: {
        tag: "ToBitcoin",
        inner: { fromTokenIdentifier: "usdb-token-id" },
      },
      tokenIdentifier: undefined,
    })
    // minFromAmount is USDB (6 decimals) → cents; minToAmount stays as sats.
    expect(result).toEqual({ minFromAmount: 50, minToAmount: 800 })
  })

  it("ceils sub-cent residues so the UI never accepts an amount the SDK will reject", async () => {
    const fetchConversionLimitsFn = jest.fn().mockResolvedValue({
      minFromAmount: BigInt(1_000_001),
      minToAmount: BigInt(0),
    })

    const result = await fetchConversionLimits(
      {
        fetchConversionLimits: fetchConversionLimitsFn,
        getInfo: mockGetInfo,
      } as never,
      ConvertDirection.UsdToBtc,
    )

    expect(result.minFromAmount).toBe(101)
  })

  it("returns null fields when the SDK returns undefined limits", async () => {
    const fetchConversionLimitsFn = jest.fn().mockResolvedValue({
      minFromAmount: undefined,
      minToAmount: undefined,
    })

    const result = await fetchConversionLimits(
      {
        fetchConversionLimits: fetchConversionLimitsFn,
        getInfo: mockGetInfo,
      } as never,
      ConvertDirection.BtcToUsd,
    )

    expect(result).toEqual({ minFromAmount: null, minToAmount: null })
  })

  it("propagates the configuration error when SPARK_TOKEN_IDENTIFIER is missing", async () => {
    mockRequireTokenId.mockImplementationOnce(() => {
      throw new Error("SPARK_TOKEN_IDENTIFIER is not configured for this build")
    })
    const fetchConversionLimitsFn = jest.fn()

    await expect(
      fetchConversionLimits(
        {
          fetchConversionLimits: fetchConversionLimitsFn,
          getInfo: mockGetInfo,
        } as never,
        ConvertDirection.BtcToUsd,
      ),
    ).rejects.toThrow("SPARK_TOKEN_IDENTIFIER is not configured for this build")
    expect(fetchConversionLimitsFn).not.toHaveBeenCalled()
  })
})
