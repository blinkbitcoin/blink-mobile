import { getParams } from "js-lnurl"
import { requestPayServiceParams } from "lnurl-pay"

import { Network } from "@app/graphql/generated"
import { resolveDestination } from "@app/screens/send-bitcoin-screen/payment-destination/resolve-destination"
import { PaymentType } from "@blinkbitcoin/blink-client"

// Real parser + LNURL resolution; only the network boundaries are mocked.
jest.mock("js-lnurl", () => ({
  ...jest.requireActual("js-lnurl"),
  getParams: jest.fn(),
}))
jest.mock("lnurl-pay", () => ({
  ...jest.requireActual("lnurl-pay"),
  requestPayServiceParams: jest.fn(),
}))

const mockParseSparkAddress = jest.fn()
jest.mock("@app/self-custodial/bridge", () => ({
  parseSparkAddress: (...args: unknown[]) => mockParseSparkAddress(...args),
}))

const mockWrapDestination = jest.fn()
jest.mock("@app/self-custodial/payment-details/wrap-destination", () => ({
  wrapDestination: (...args: unknown[]) => mockWrapDestination(...args),
}))

// Payment-detail builders are lazy (createPaymentDetail closures); stub them so the
// real parser graph loads without pulling the heavy detail factories.
jest.mock("@app/screens/send-bitcoin-screen/payment-details", () => ({
  createIntraledgerPaymentDetails: jest.fn(),
  createLnurlPaymentDetails: jest.fn(),
}))

const mockGetParams = getParams as jest.MockedFunction<typeof getParams>
const mockRequestPayServiceParams = requestPayServiceParams as jest.MockedFunction<
  typeof requestPayServiceParams
>

describe("resolveDestination (integration: real parser)", () => {
  const fakeSdk = { id: "sdk" } as never
  const lnAddressHostname = "blink.sv"

  beforeEach(() => {
    jest.clearAllMocks()
    mockParseSparkAddress.mockResolvedValue(null)
    mockWrapDestination.mockImplementation((result) => result)
    mockGetParams.mockResolvedValue({} as never)
    mockRequestPayServiceParams.mockResolvedValue({
      callback: "https://blink.sv/callback",
      fixed: false,
      min: 1,
      max: 1000000,
      domain: lnAddressHostname,
      metadata: [["text/plain", "pay esaudeveloper"]],
      metadataHash: "hash",
      identifier: `esaudeveloper@${lnAddressHostname}`,
      description: "",
      image: "",
      commentAllowed: 0,
      rawData: {},
    } as never)
  })

  it("routes a self-custodial send to a bare username through LNURL, not the custodial intraledger path", async () => {
    const accountDefaultWalletQuery = jest.fn().mockResolvedValue({
      data: { accountDefaultWallet: { id: "recipient-wallet-id" } },
    })

    const result = await resolveDestination(
      {
        rawInput: "esaudeveloper",
        myWalletIds: ["my-wallet-id"],
        bitcoinNetwork: Network.Mainnet,
        lnurlDomains: [],
        accountDefaultWalletQuery: accountDefaultWalletQuery as never,
      },
      fakeSdk,
      lnAddressHostname,
    )

    expect(result.valid).toBe(true)
    expect(result.valid && result.validDestination.paymentType).toBe(PaymentType.Lnurl)
    expect(mockWrapDestination).toHaveBeenCalled()
  })
})
