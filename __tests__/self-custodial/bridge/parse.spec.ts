/* eslint-disable camelcase */
import { parseSparkAddress } from "@app/self-custodial/bridge/parse"

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
