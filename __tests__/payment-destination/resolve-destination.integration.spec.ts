import { getParams } from "js-lnurl"
import { requestPayServiceParams } from "lnurl-pay"
import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"

import { Network } from "@app/graphql/generated"
import { parseDestination } from "@app/screens/send-bitcoin-screen/payment-destination"
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

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockSparkNetwork.Regtest,
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
      { sdk: fakeSdk, network: mockSparkNetwork.Regtest },
      lnAddressHostname,
    )

    expect(result.valid).toBe(true)
    expect(result.valid && result.validDestination.paymentType).toBe(PaymentType.Lnurl)
    expect(mockWrapDestination).toHaveBeenCalled()
  })

  /**
   * The domains a self-custodial sender declares are what let a Blink pay code be
   * recognised as naming an account. They must not also route it over the ledger: the
   * wallet has no token for that mutation, and the recipient's own address is the whole
   * point of recognising it.
   */
  it("keeps a self-custodial send on LNURL even when the recipient is on a declared domain", async () => {
    const accountDefaultWalletQuery = jest.fn().mockResolvedValue({
      data: { accountDefaultWallet: { id: "recipient-wallet-id" } },
    })

    const result = await resolveDestination(
      {
        rawInput: "esaudeveloper@blink.sv",
        myWalletIds: ["my-wallet-id"],
        bitcoinNetwork: Network.Mainnet,
        lnurlDomains: [lnAddressHostname, "pay.blink.sv"],
        accountDefaultWalletQuery: accountDefaultWalletQuery as never,
      },
      { sdk: fakeSdk, network: mockSparkNetwork.Regtest },
      lnAddressHostname,
    )

    expect(result.valid && result.validDestination.paymentType).toBe(PaymentType.Lnurl)
    expect(accountDefaultWalletQuery).not.toHaveBeenCalled()
  })

  it("still pays a custodial send to a declared domain over the ledger", async () => {
    const accountDefaultWalletQuery = jest.fn().mockResolvedValue({
      data: { accountDefaultWallet: { id: "recipient-wallet-id" } },
    })

    const result = await resolveDestination(
      {
        rawInput: "esaudeveloper@blink.sv",
        myWalletIds: ["my-wallet-id"],
        bitcoinNetwork: Network.Mainnet,
        lnurlDomains: [lnAddressHostname, "pay.blink.sv"],
        accountDefaultWalletQuery: accountDefaultWalletQuery as never,
      },
      { sdk: null, network: mockSparkNetwork.Regtest },
      lnAddressHostname,
    )

    expect(result.valid && result.validDestination.paymentType).toBe(
      PaymentType.Intraledger,
    )
  })

  it("routes a custodial send to a non-custodial Blink username through LNURL via the flag fallback", async () => {
    // No custodial wallet for the handle: the recipient is self-custodial, not custodial.
    const accountDefaultWalletQuery = jest.fn().mockResolvedValue({
      data: { accountDefaultWallet: null },
    })

    const result = await resolveDestination(
      {
        rawInput: "esaudeveloper@blink.sv",
        myWalletIds: ["my-wallet-id"],
        bitcoinNetwork: Network.Mainnet,
        lnurlDomains: [lnAddressHostname],
        accountDefaultWalletQuery: accountDefaultWalletQuery as never,
      },
      { sdk: null, network: mockSparkNetwork.Regtest },
      lnAddressHostname,
    )

    expect(result.valid).toBe(true)
    expect(result.valid && result.validDestination.paymentType).toBe(PaymentType.Lnurl)
  })

  it("resolves a lightning address with surrounding whitespace", async () => {
    const accountDefaultWalletQuery = jest.fn().mockResolvedValue({
      data: { accountDefaultWallet: null },
    })

    const result = await resolveDestination(
      {
        rawInput: "\t esaudeveloper@blink.sv \n",
        myWalletIds: ["my-wallet-id"],
        bitcoinNetwork: Network.Mainnet,
        lnurlDomains: [lnAddressHostname],
        accountDefaultWalletQuery: accountDefaultWalletQuery as never,
      },
      { sdk: null, network: mockSparkNetwork.Regtest },
      lnAddressHostname,
    )

    expect(result.valid).toBe(true)
    expect(result.valid && result.validDestination.paymentType).toBe(PaymentType.Lnurl)
    // no whitespace may leak into the resolved destination
    const identifier =
      result.valid && "lnurlParams" in result.validDestination
        ? result.validDestination.lnurlParams.identifier
        : undefined
    expect(identifier).toBe("esaudeveloper@blink.sv")
  })

  it("resolves a matching-network Spark address to a valid Spark destination", async () => {
    mockParseSparkAddress.mockResolvedValue({
      address: "sparkrt1qabcdefghijklmn",
      identityPublicKey: "pubkey123",
      networkMatch: true,
    })

    const result = await resolveDestination(
      {
        rawInput: "sparkrt1qabcdefghijklmn",
        myWalletIds: ["my-wallet-id"],
        bitcoinNetwork: Network.Mainnet,
        lnurlDomains: [],
        accountDefaultWalletQuery: jest.fn() as never,
      },
      { sdk: fakeSdk, network: mockSparkNetwork.Regtest },
      lnAddressHostname,
    )

    expect(result.valid).toBe(true)
    expect(result.valid && result.validDestination.paymentType).toBe("spark")
  })

  it("marks a wrong-network Spark address invalid without falling through to the generic parser", async () => {
    mockParseSparkAddress.mockResolvedValue({
      address: "spark1qabcdefghijklmn",
      identityPublicKey: "pubkey123",
      networkMatch: false,
    })

    const result = await resolveDestination(
      {
        rawInput: "spark1qabcdefghijklmn",
        myWalletIds: ["my-wallet-id"],
        bitcoinNetwork: Network.Mainnet,
        lnurlDomains: [],
        accountDefaultWalletQuery: jest.fn() as never,
      },
      { sdk: fakeSdk, network: mockSparkNetwork.Regtest },
      lnAddressHostname,
    )

    expect(result.valid).toBe(false)
    expect(!result.valid && result.invalidReason).toBe("WrongNetwork")
  })
})

describe("parseDestination (integration: real parser)", () => {
  // parseDestination is also called directly, bypassing resolveDestination
  // (e.g. modal-nfc.tsx), so its own trim is pinned here.
  it("trims surrounding whitespace before parsing", async () => {
    const accountDefaultWalletQuery = jest.fn().mockResolvedValue({
      data: { accountDefaultWallet: { id: "recipient-wallet-id" } },
    })

    const result = await parseDestination({
      rawInput: "  esaudeveloper@blink.sv  ",
      myWalletIds: ["my-wallet-id"],
      bitcoinNetwork: Network.Mainnet,
      lnurlDomains: ["blink.sv"],
      accountDefaultWalletQuery: accountDefaultWalletQuery as never,
    })

    expect(result.valid).toBe(true)
    expect(
      result.valid &&
        result.validDestination.paymentType === PaymentType.Intraledger &&
        result.validDestination.handle,
    ).toBe("esaudeveloper")
  })
})
