import {
  findUsdbToken,
  fetchUsdbDecimals,
} from "@app/self-custodial/bridge/token-balance"

const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: mockRecordError, log: jest.fn() }),
}))

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: {},
  requireSparkTokenIdentifier: () => "test-token-id",
  SparkToken: { DefaultDecimals: 6, Label: "USDB", Ticker: "USDB" },
}))

const loadFreshModule = () => {
  let mod: typeof import("@app/self-custodial/bridge/token-balance") | undefined
  jest.isolateModules(() => {
    mod = require("@app/self-custodial/bridge/token-balance")
  })
  return mod!
}

const usdbToken = {
  balance: BigInt(500_000),
  tokenMetadata: {
    identifier: "test-token-id",
    decimals: 6,
    ticker: "USDB",
  },
}

const otherToken = {
  balance: BigInt(100),
  tokenMetadata: {
    identifier: "other-token",
    decimals: 8,
    ticker: "OTHER",
  },
}

describe("findUsdbToken", () => {
  it("returns the USDB token when tokenBalances is an object keyed by identifier", () => {
    const info = {
      tokenBalances: {
        "test-token-id": usdbToken,
        "other-token": otherToken,
      },
    } as never

    expect(findUsdbToken(info)).toBe(usdbToken)
  })

  it("returns the USDB token when tokenBalances is a Map", () => {
    const info = {
      tokenBalances: new Map([
        ["test-token-id", usdbToken],
        ["other-token", otherToken],
      ]),
    } as never

    expect(findUsdbToken(info)).toBe(usdbToken)
  })

  it("returns undefined when the SDK has no token balances", () => {
    const info = { tokenBalances: {} } as never

    expect(findUsdbToken(info)).toBeUndefined()
  })

  it("returns undefined when tokenBalances is missing", () => {
    const info = {} as never

    expect(findUsdbToken(info)).toBeUndefined()
  })

  it("returns undefined when only unrelated tokens are present", () => {
    const info = { tokenBalances: { "other-token": otherToken } } as never

    expect(findUsdbToken(info)).toBeUndefined()
  })
})

describe("fetchUsdbDecimals", () => {
  it("returns the USDB token's decimals when present", async () => {
    const sdk = {
      getInfo: jest.fn().mockResolvedValue({
        tokenBalances: { "test-token-id": usdbToken },
      }),
    } as never

    await expect(fetchUsdbDecimals(sdk)).resolves.toBe(6)
  })

  it("falls back to SparkToken.DefaultDecimals when the USDB token is missing", async () => {
    const sdk = {
      getInfo: jest.fn().mockResolvedValue({ tokenBalances: {} }),
    } as never

    await expect(fetchUsdbDecimals(sdk)).resolves.toBe(6)
  })

  it("falls back when tokenMetadata is missing on the found token", async () => {
    const sdk = {
      getInfo: jest.fn().mockResolvedValue({
        tokenBalances: {
          "test-token-id": {
            balance: BigInt(0),
            tokenMetadata: { identifier: "test-token-id" },
          },
        },
      }),
    } as never

    await expect(fetchUsdbDecimals(sdk)).resolves.toBe(6)
  })

  it("calls sdk.getInfo with ensureSynced: false to avoid blocking on sync", async () => {
    const getInfo = jest.fn().mockResolvedValue({ tokenBalances: {} })
    const sdk = { getInfo } as never

    await fetchUsdbDecimals(sdk)

    expect(getInfo).toHaveBeenCalledWith({ ensureSynced: false })
  })
})

describe("token-balance crashlytics reporting", () => {
  beforeEach(() => {
    mockRecordError.mockClear()
  })

  it("records to crashlytics once when the expected token is missing (dedupes within session)", () => {
    const fresh = loadFreshModule()
    const info = { tokenBalances: { "other-token": otherToken } } as never

    fresh.findUsdbToken(info)
    fresh.findUsdbToken(info)
    fresh.findUsdbToken(info)

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toContain("test-token-id")
  })

  it("records to crashlytics once when the token is present but lacks decimals metadata", async () => {
    const fresh = loadFreshModule()
    const tokenWithoutDecimals = {
      balance: BigInt(0),
      tokenMetadata: { identifier: "test-token-id" },
    }
    const sdk = {
      getInfo: jest.fn().mockResolvedValue({
        tokenBalances: { "test-token-id": tokenWithoutDecimals },
      }),
    } as never

    await fresh.fetchUsdbDecimals(sdk)
    await fresh.fetchUsdbDecimals(sdk)

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toContain("decimals")
  })
})
