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
}))

jest.mock("react-native-config", () => ({
  BREEZ_NETWORK: "regtest",
}))

const createMockSdk = (parseResult: unknown) =>
  ({ parse: jest.fn().mockResolvedValue(parseResult) }) as never

describe("parseSparkAddress", () => {
  it("returns parsed address when SDK detects SparkAddress", async () => {
    const sdk = createMockSdk({
      tag: "SparkAddress",
      inner: [
        {
          address: "spark1abc...",
          identityPublicKey: "pubkey123",
          network: 4,
        },
      ],
    })

    const result = await parseSparkAddress(sdk, "spark1abc...")

    expect(result).not.toBeNull()
    expect(result?.address).toBe("spark1abc...")
    expect(result?.identityPublicKey).toBe("pubkey123")
    expect(result?.networkMatch).toBe(true)
  })

  it("returns networkMatch false when networks differ", async () => {
    const sdk = createMockSdk({
      tag: "SparkAddress",
      inner: [
        {
          address: "spark1abc...",
          identityPublicKey: "pubkey123",
          network: 0,
        },
      ],
    })

    const result = await parseSparkAddress(sdk, "spark1abc...")

    expect(result).not.toBeNull()
    expect(result?.networkMatch).toBe(false)
  })

  it("returns null when input is not a SparkAddress", async () => {
    const sdk = createMockSdk({
      tag: "BitcoinAddress",
      inner: [{ address: "bc1q..." }],
    })

    const result = await parseSparkAddress(sdk, "bc1q...")

    expect(result).toBeNull()
  })

  it("returns null when SDK throws", async () => {
    const sdk = {
      parse: jest.fn().mockRejectedValue(new Error("parse failed")),
    } as never

    const result = await parseSparkAddress(sdk, "invalid")

    expect(result).toBeNull()
  })
})

describe("parseSparkAddressDetailed (I15 — distinguishes 'not Spark' from 'SDK threw')", () => {
  it("returns Match outcome with the address payload on success", async () => {
    const sdk = createMockSdk({
      tag: "SparkAddress",
      inner: [
        {
          address: "spark1abc...",
          identityPublicKey: "pubkey",
          network: 4,
        },
      ],
    })

    const result = await parseSparkAddressDetailed(sdk, "spark1abc...")

    expect(result.outcome).toBe(ParseSparkAddressOutcome.Match)
    if (result.outcome === ParseSparkAddressOutcome.Match) {
      expect(result.address.address).toBe("spark1abc...")
      expect(result.address.networkMatch).toBe(true)
    }
  })

  it("returns NotSparkAddress when the SDK parses input as something else", async () => {
    const sdk = createMockSdk({
      tag: "BitcoinAddress",
      inner: [{ address: "bc1q..." }],
    })

    const result = await parseSparkAddressDetailed(sdk, "bc1q...")

    expect(result.outcome).toBe(ParseSparkAddressOutcome.NotSparkAddress)
  })

  it("returns ParseError carrying the original error when the SDK rejects", async () => {
    const sdkErr = new Error("SDK exploded")
    const sdk = {
      parse: jest.fn().mockRejectedValue(sdkErr),
    } as never

    const result = await parseSparkAddressDetailed(sdk, "anything")

    expect(result.outcome).toBe(ParseSparkAddressOutcome.ParseError)
    if (result.outcome === ParseSparkAddressOutcome.ParseError) {
      expect(result.error).toBe(sdkErr)
    }
  })
})
