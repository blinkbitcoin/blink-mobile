import { getParams } from "js-lnurl"
import { requestPayServiceParams, LnUrlPayServiceResponse, Satoshis } from "lnurl-pay"

import { Network } from "@app/graphql/generated"
import {
  getLnurlFromUnifiedUri,
  parseDestination,
} from "@app/screens/send-bitcoin-screen/payment-destination"
import { DestinationDirection } from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { PaymentType } from "@blinkbitcoin/blink-client"

// Real parser + LNURL detection; only the network boundaries are mocked.
jest.mock("js-lnurl", () => ({
  ...jest.requireActual("js-lnurl"),
  getParams: jest.fn(),
}))
jest.mock("lnurl-pay", () => ({
  ...jest.requireActual("lnurl-pay"),
  requestPayServiceParams: jest.fn(),
}))

// Payment-detail builders are lazy (createPaymentDetail closures); stub them so the
// real parser graph loads without pulling the heavy detail factories.
jest.mock("@app/screens/send-bitcoin-screen/payment-details", () => ({
  createAmountOnchainPaymentDetails: jest.fn(),
  createNoAmountOnchainPaymentDetails: jest.fn(),
  createAmountLightningPaymentDetails: jest.fn(),
  createNoAmountLightningPaymentDetails: jest.fn(),
  createIntraledgerPaymentDetails: jest.fn(),
  createLnurlPaymentDetails: jest.fn(),
}))

const mockGetParams = getParams as jest.MockedFunction<typeof getParams>
const mockRequestPayServiceParams = requestPayServiceParams as jest.MockedFunction<
  typeof requestPayServiceParams
>

// BIP-173 mainnet test vector
const onchainAddress = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
// LNURL from issue #3964 (BTCPay unified QR), lowercased
const lnurl =
  "lnurl1dp68gurn8ghj7cn5vdcxz7fwwpjhg7nnvd5zuet49ap9gse024y5cnj42fxz7urp0yhkjt64f44yxdr3f3vxz3nhxdmhxkt2v9png33kgg7u80eh"
// BOLT11 spec test vector (donation invoice, no expiry tag)
const bolt11 =
  "lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w"

const externalLnurlPayParams: LnUrlPayServiceResponse = {
  callback: "https://external.com/callback",
  fixed: false,
  min: 1 as Satoshis,
  max: 1000000 as Satoshis,
  domain: "external.com",
  metadata: [["text/plain", "pay bob"]],
  metadataHash: "hash",
  identifier: "bob@external.com",
  description: "",
  image: "",
  commentAllowed: 0,
  rawData: {},
}

const parseParams = (rawInput: string) => ({
  rawInput,
  myWalletIds: ["my-wallet-id"],
  bitcoinNetwork: Network.Mainnet,
  lnurlDomains: ["blink.sv"],
  accountDefaultWalletQuery: jest.fn() as never,
})

describe("parseDestination with unified BIP-21 URIs", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetParams.mockResolvedValue({
      status: "OK",
      reason: "",
      domain: "external.com",
      url: "https://external.com",
    } as never)
    mockRequestPayServiceParams.mockResolvedValue(externalLnurlPayParams)
  })

  it("prefers the lightning= LNURL over the onchain address", async () => {
    const destination = await parseDestination(
      parseParams(`bitcoin:${onchainAddress}?lightning=${lnurl}`),
    )

    expect(destination).toEqual(
      expect.objectContaining({
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: expect.objectContaining({
          paymentType: PaymentType.Lnurl,
          lnurl,
        }),
      }),
    )
  })

  it("handles fully-uppercase BTCPay QR content", async () => {
    const destination = await parseDestination(
      parseParams(
        `BITCOIN:${onchainAddress.toUpperCase()}?LIGHTNING=${lnurl.toUpperCase()}`,
      ),
    )

    expect(destination).toEqual(
      expect.objectContaining({
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: expect.objectContaining({
          paymentType: PaymentType.Lnurl,
          lnurl,
        }),
      }),
    )
  })

  it("prefers the LNURL even when the onchain address is on the wrong network", async () => {
    const testnetAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"

    const destination = await parseDestination(
      parseParams(`bitcoin:${testnetAddress}?lightning=${lnurl}`),
    )

    expect(destination).toEqual(
      expect.objectContaining({
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: expect.objectContaining({
          paymentType: PaymentType.Lnurl,
          lnurl,
        }),
      }),
    )
  })

  it("falls back to the onchain address and amount when LNURL resolution fails", async () => {
    mockRequestPayServiceParams.mockRejectedValue(new Error("network error"))

    const destination = await parseDestination(
      parseParams(`bitcoin:${onchainAddress}?amount=0.001&lightning=${lnurl}`),
    )

    expect(destination).toEqual(
      expect.objectContaining({
        valid: true,
        validDestination: expect.objectContaining({
          paymentType: PaymentType.Onchain,
          address: onchainAddress,
          amount: 100000,
        }),
      }),
    )
  })

  it("falls back to the onchain address when LNURL resolution throws hard", async () => {
    mockRequestPayServiceParams.mockRejectedValue(new Error("network error"))
    mockGetParams.mockRejectedValue(new Error("network error"))

    const destination = await parseDestination(
      parseParams(`bitcoin:${onchainAddress}?lightning=${lnurl}`),
    )

    expect(destination).toEqual(
      expect.objectContaining({
        valid: true,
        validDestination: expect.objectContaining({
          paymentType: PaymentType.Onchain,
          address: onchainAddress,
        }),
      }),
    )
  })

  it("leaves plain onchain URIs untouched", async () => {
    const destination = await parseDestination(
      parseParams(`bitcoin:${onchainAddress}?amount=0.001`),
    )

    expect(destination).toEqual(
      expect.objectContaining({
        valid: true,
        validDestination: expect.objectContaining({
          paymentType: PaymentType.Onchain,
          address: onchainAddress,
        }),
      }),
    )
    expect(mockRequestPayServiceParams).not.toHaveBeenCalled()
    expect(mockGetParams).not.toHaveBeenCalled()
  })

  it("still resolves a lightning= bolt11 invoice as Lightning", async () => {
    const destination = await parseDestination(
      parseParams(`bitcoin:${onchainAddress}?lightning=${bolt11}`),
    )

    expect(destination).toEqual(
      expect.objectContaining({
        valid: true,
        validDestination: expect.objectContaining({
          paymentType: PaymentType.Lightning,
          paymentRequest: bolt11,
        }),
      }),
    )
    expect(mockRequestPayServiceParams).not.toHaveBeenCalled()
    expect(mockGetParams).not.toHaveBeenCalled()
  })
})

describe("getLnurlFromUnifiedUri", () => {
  it("extracts an LNURL from the lightning param", () => {
    expect(getLnurlFromUnifiedUri(`bitcoin:${onchainAddress}?lightning=${lnurl}`)).toBe(
      lnurl,
    )
  })

  it("matches param name and value case-insensitively", () => {
    expect(
      getLnurlFromUnifiedUri(
        `BITCOIN:${onchainAddress.toUpperCase()}?AMOUNT=0.001&LIGHTNING=${lnurl.toUpperCase()}`,
      ),
    ).toBe(lnurl)
  })

  it("decodes percent-encoded values", () => {
    expect(
      getLnurlFromUnifiedUri(
        `bitcoin:${onchainAddress}?lightning=${encodeURIComponent(lnurl.toUpperCase())}`,
      ),
    ).toBe(lnurl)
  })

  it("keeps the raw value when percent-decoding fails", () => {
    // trailing bare "%" makes decodeURIComponent throw; the raw value still parses
    expect(
      getLnurlFromUnifiedUri(
        `bitcoin:${onchainAddress}?lightning=${lnurl.toUpperCase()}%`,
      ),
    ).toBe(lnurl)
  })

  it("returns undefined when there is no lightning param", () => {
    expect(getLnurlFromUnifiedUri(`bitcoin:${onchainAddress}?amount=0.001`)).toBe(
      undefined,
    )
  })

  it("returns undefined for bolt11 values (handled by the library)", () => {
    expect(getLnurlFromUnifiedUri(`bitcoin:${onchainAddress}?lightning=${bolt11}`)).toBe(
      undefined,
    )
  })
})
