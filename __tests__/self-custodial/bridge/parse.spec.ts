/* eslint-disable camelcase */
import {
  parseSparkAddress,
  parseSparkAddressDetailed,
  ParseSparkAddressOutcome,
} from "@app/self-custodial/bridge/parse"

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  BitcoinNetwork: { Bitcoin: 0, Regtest: 4 },
  InputType_Tags: { SparkAddress: "SparkAddress", BitcoinAddress: "BitcoinAddress" },
}))

jest.mock("@app/self-custodial/config", () => ({
  SparkConfig: { network: 1 },
  hasSparkAddressShape: (input: string): boolean => /^(?:sp1|sprt1)/i.test(input.trim()),
}))

jest.mock("react-native-config", () => ({
  BREEZ_NETWORK: "regtest",
}))

const SPARK_REGTEST_INPUT = "sprt1qabcdefghijklmn"
const SPARK_MAINNET_INPUT = "sp1qabcdefghijklmn"
const LNURL_INPUT = "lnurl1examplefixtureonly"

const createMockSdk = (parseResult: unknown) =>
  ({ parse: jest.fn().mockResolvedValue(parseResult) }) as never

const createInspectableSdk = (parseResult: unknown) => {
  const parseFn = jest.fn().mockResolvedValue(parseResult)
  return { sdk: { parse: parseFn } as never, parseFn }
}

describe("parseSparkAddress", () => {
  it("returns parsed address when SDK detects SparkAddress", async () => {
    const sdk = createMockSdk({
      tag: "SparkAddress",
      inner: [
        {
          address: SPARK_REGTEST_INPUT,
          identityPublicKey: "pubkey123",
          network: 4,
        },
      ],
    })

    const result = await parseSparkAddress(sdk, SPARK_REGTEST_INPUT)

    expect(result).not.toBeNull()
    expect(result?.address).toBe(SPARK_REGTEST_INPUT)
    expect(result?.identityPublicKey).toBe("pubkey123")
    expect(result?.networkMatch).toBe(true)
  })

  it("returns networkMatch false when networks differ", async () => {
    const sdk = createMockSdk({
      tag: "SparkAddress",
      inner: [
        {
          address: SPARK_MAINNET_INPUT,
          identityPublicKey: "pubkey123",
          network: 0,
        },
      ],
    })

    const result = await parseSparkAddress(sdk, SPARK_MAINNET_INPUT)

    expect(result).not.toBeNull()
    expect(result?.networkMatch).toBe(false)
  })

  it("returns null when input is not a SparkAddress", async () => {
    const sdk = createMockSdk({
      tag: "BitcoinAddress",
      inner: [{ address: "bc1q..." }],
    })

    const result = await parseSparkAddress(sdk, SPARK_REGTEST_INPUT)

    expect(result).toBeNull()
  })

  it("returns null when SDK throws", async () => {
    const sdk = {
      parse: jest.fn().mockRejectedValue(new Error("parse failed")),
    } as never

    const result = await parseSparkAddress(sdk, SPARK_REGTEST_INPUT)

    expect(result).toBeNull()
  })
})

describe("parseSparkAddressDetailed", () => {
  it("returns Match outcome with the address payload on success", async () => {
    const sdk = createMockSdk({
      tag: "SparkAddress",
      inner: [
        {
          address: SPARK_REGTEST_INPUT,
          identityPublicKey: "pubkey",
          network: 4,
        },
      ],
    })

    const result = await parseSparkAddressDetailed(sdk, SPARK_REGTEST_INPUT)

    expect(result.outcome).toBe(ParseSparkAddressOutcome.Match)
    if (result.outcome === ParseSparkAddressOutcome.Match) {
      expect(result.address.address).toBe(SPARK_REGTEST_INPUT)
      expect(result.address.networkMatch).toBe(true)
    }
  })

  it("returns NotSparkAddress when the SDK parses input as something else", async () => {
    const sdk = createMockSdk({
      tag: "BitcoinAddress",
      inner: [{ address: "bc1q..." }],
    })

    const result = await parseSparkAddressDetailed(sdk, SPARK_REGTEST_INPUT)

    expect(result.outcome).toBe(ParseSparkAddressOutcome.NotSparkAddress)
  })

  it("returns ParseError carrying the original error when the SDK rejects", async () => {
    const sdkErr = new Error("SDK exploded")
    const sdk = {
      parse: jest.fn().mockRejectedValue(sdkErr),
    } as never

    const result = await parseSparkAddressDetailed(sdk, SPARK_REGTEST_INPUT)

    expect(result.outcome).toBe(ParseSparkAddressOutcome.ParseError)
    if (result.outcome === ParseSparkAddressOutcome.ParseError) {
      expect(result.error).toBe(sdkErr)
    }
  })
})

describe("parseSparkAddressDetailed — shape gate integration with hasSparkAddressShape", () => {
  it("short-circuits to NotSparkAddress without invoking the SDK when the input cannot be a Spark address", async () => {
    const parseFn = jest.fn()
    const sdk = { parse: parseFn } as never

    const result = await parseSparkAddressDetailed(sdk, LNURL_INPUT)

    expect(result.outcome).toBe(ParseSparkAddressOutcome.NotSparkAddress)
    expect(parseFn).not.toHaveBeenCalled()
  })

  it("forwards the trimmed input to the SDK when the shape gate passes", async () => {
    const padded = `  ${SPARK_REGTEST_INPUT}`
    const { sdk, parseFn } = createInspectableSdk({
      tag: "SparkAddress",
      inner: [{ address: SPARK_REGTEST_INPUT, identityPublicKey: "pk", network: 4 }],
    })

    await parseSparkAddressDetailed(sdk, padded)

    expect(parseFn).toHaveBeenCalledWith(SPARK_REGTEST_INPUT)
  })
})
