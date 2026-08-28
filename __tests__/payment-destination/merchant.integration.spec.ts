import { Network } from "@app/graphql/generated"
import { parseDestination } from "@app/screens/send-bitcoin-screen/payment-destination"
import { resolveMerchantChoiceDestination } from "@app/screens/send-bitcoin-screen/payment-destination/merchant"
import {
  DestinationDirection,
  InvalidDestinationReason,
  isMerchantChoiceDestination,
  MerchantPaymentType,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { getParams } from "js-lnurl"
import { requestPayServiceParams, Satoshis } from "lnurl-pay"
import { PaymentType } from "@blinkbitcoin/blink-client"

jest.mock("lnurl-pay", () => ({
  ...jest.requireActual("lnurl-pay"),
  requestPayServiceParams: jest.fn(),
}))

jest.mock("js-lnurl", () => ({
  getParams: jest.fn(),
}))

const evmRecipient = "0x52908400098527886E0F7030069857D2E4169EE7"
const tronRecipient = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb"
const requestPayServiceParamsMock = requestPayServiceParams as jest.MockedFunction<
  typeof requestPayServiceParams
>
const getParamsMock = getParams as jest.MockedFunction<typeof getParams>

describe("merchant payment destination integration", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getParamsMock.mockResolvedValue({ status: "OK" } as never)
  })

  const parseMerchantDestination = () =>
    parseDestination({
      rawInput: evmRecipient,
      myWalletIds: ["wallet-id"],
      bitcoinNetwork: Network.Mainnet,
      lnurlDomains: ["blink.sv"],
      accountDefaultWalletQuery: jest.fn() as never,
      inputSource: "manual",
      displayCurrency: "USD",
    })

  it("preserves exact merchant choices produced by blink-client fixtures", async () => {
    const result = await parseMerchantDestination()

    expect(isMerchantChoiceDestination(result)).toBe(true)
    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: expect.objectContaining({
          paymentType: MerchantPaymentType,
          merchants: expect.any(Array),
        }),
      }),
    )

    if (!isMerchantChoiceDestination(result)) throw new Error("Expected merchant choices")

    expect(result.validDestination.merchants).toHaveLength(10)
    expect(result.validDestination.merchants[0]).toEqual({
      id: "blink-boltz-usdc-arbitrum",
      lnurl: `${evmRecipient}+USDC+Arbitrum@swap.blink.sv`,
      category: "swap",
      title: "USDC Arbitrum",
      description: "Swap sats to USDC on Arbitrum",
      companyName: "Boltz",
      termsUrl: "https://boltz.exchange/terms",
    })
    expect(
      result.validDestination.merchants.find(
        ({ id }) => id === "blink-boltz-usdt-ethereum",
      ),
    ).toEqual(
      expect.objectContaining({
        id: "blink-boltz-usdt-ethereum",
        lnurl: `${evmRecipient}+USDT+Ethereum@swap.blink.sv`,
        category: "swap",
        title: "USDT Ethereum",
        description: "Swap sats to USDT on Ethereum",
        companyName: "Boltz",
        termsUrl: "https://boltz.exchange/terms",
      }),
    )
  })

  it("does not classify multiple merchant choices as unknown", async () => {
    const result = await parseMerchantDestination()

    expect(result.valid).toBe(true)
    expect(result).not.toEqual(
      expect.objectContaining({
        invalidReason: InvalidDestinationReason.UnknownDestination,
      }),
    )
  })

  it("auto-selects a single real merchant fixture and continues through LNURL", async () => {
    const expectedMerchant = {
      id: "blink-boltz-usdt-tron",
      lnurl: `${tronRecipient}+USDT+Tron@swap.blink.sv`,
      category: "swap",
      title: "USDT Tron",
      description: "Swap sats to USDT on Tron",
      companyName: "Boltz",
      termsUrl: "https://boltz.exchange/terms",
    }
    const lnurlParams = {
      callback: "https://example.com/callback",
      fixed: true,
      min: 0 as Satoshis,
      max: 2000 as Satoshis,
      domain: "swap.blink.sv",
      metadata: [["text/plain", "description"]],
      metadataHash: "mocked_metadata_hash",
      identifier: expectedMerchant.lnurl,
      description: "mocked_description",
      image: "",
      commentAllowed: 0,
      rawData: {},
    }
    requestPayServiceParamsMock.mockResolvedValue(lnurlParams)

    const result = await parseDestination({
      rawInput: tronRecipient,
      myWalletIds: ["wallet-id"],
      bitcoinNetwork: Network.Mainnet,
      lnurlDomains: ["blink.sv"],
      accountDefaultWalletQuery: jest.fn() as never,
      inputSource: "manual",
      displayCurrency: "USD",
    })

    expect(requestPayServiceParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({ lnUrlOrAddress: expectedMerchant.lnurl }),
    )
    expect(isMerchantChoiceDestination(result)).toBe(false)
    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: expect.objectContaining({
          paymentType: PaymentType.Lnurl,
          lnurl: expectedMerchant.lnurl,
          isMerchant: true,
          merchant: expectedMerchant,
          lnurlParams,
        }),
      }),
    )
  })

  it("resolves a selected real multi-merchant fixture with merchant metadata intact", async () => {
    const merchantChoices = await parseMerchantDestination()
    if (!isMerchantChoiceDestination(merchantChoices)) {
      throw new Error("Expected merchant choices")
    }
    const selectedMerchant = merchantChoices.validDestination.merchants[0]
    const lnurlParams = {
      callback: "https://example.com/callback",
      fixed: true,
      min: 0 as Satoshis,
      max: 2000 as Satoshis,
      domain: "swap.blink.sv",
      metadata: [["text/plain", "description"]],
      metadataHash: "mocked_metadata_hash",
      identifier: selectedMerchant.lnurl,
      description: "mocked_description",
      image: "",
      commentAllowed: 0,
      rawData: {},
    }
    requestPayServiceParamsMock.mockResolvedValue(lnurlParams)

    const result = await resolveMerchantChoiceDestination({
      merchant: selectedMerchant,
      params: {
        rawInput: selectedMerchant.lnurl,
        myWalletIds: ["wallet-id"],
        bitcoinNetwork: Network.Mainnet,
        lnurlDomains: ["blink.sv"],
        accountDefaultWalletQuery: jest.fn() as never,
        inputSource: "manual",
        displayCurrency: "USD",
      },
      sdk: null,
    })

    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: expect.objectContaining({
          paymentType: PaymentType.Lnurl,
          lnurl: selectedMerchant.lnurl,
          isMerchant: true,
          merchant: selectedMerchant,
          lnurlParams,
        }),
      }),
    )
  })
  /**
   * The reported payload from blink-wip#1175. blink-client already matches the host
   * and hands back a Money Badger lnurl, so a rejected scan is the merchant service
   * answering, not a parser that failed to recognise the code. Pinned here because
   * the ticket was filed as a parsing gap and the next reader will assume the same.
   */
  describe("a scanned merchant bill URL", () => {
    const billUrl = "https://za.wigroup.co/bill/172366037"
    const billLnurl = "https%3A%2F%2Fza.wigroup.co%2Fbill%2F172366037@cryptoqr.net"

    const parseBillUrl = () =>
      parseDestination({
        rawInput: billUrl,
        myWalletIds: ["wallet-id"],
        bitcoinNetwork: Network.Mainnet,
        lnurlDomains: ["blink.sv"],
        accountDefaultWalletQuery: jest.fn() as never,
        inputSource: "qr",
        displayCurrency: "ZAR",
      })

    it("reaches the merchant lnurl service instead of being rejected as unparseable", async () => {
      requestPayServiceParamsMock.mockRejectedValue(
        Object.assign(new Error("Request failed with status code 500"), {
          response: { status: 500 },
        }),
      )

      await parseBillUrl()

      expect(requestPayServiceParamsMock).toHaveBeenCalledWith(
        expect.objectContaining({ lnUrlOrAddress: billLnurl }),
      )
    })

    it("reports a service that cannot resolve the bill as a service error", async () => {
      requestPayServiceParamsMock.mockRejectedValue(
        Object.assign(new Error("Request failed with status code 500"), {
          response: { status: 500 },
        }),
      )

      expect(await parseBillUrl()).toEqual(
        expect.objectContaining({
          valid: false,
          invalidReason: InvalidDestinationReason.LnurlServiceError,
        }),
      )
    })

    it("pays the bill when the merchant service resolves it", async () => {
      requestPayServiceParamsMock.mockResolvedValue({
        callback: "https://cryptoqr.net/callback",
        fixed: true,
        min: 0 as Satoshis,
        max: 2000 as Satoshis,
        domain: "cryptoqr.net",
        metadata: [["text/plain", "Bootlegger Hartenbos"]],
        metadataHash: "mocked_metadata_hash",
        identifier: billLnurl,
        description: "Bootlegger Hartenbos",
        image: "",
        commentAllowed: 0,
        rawData: {},
      })

      expect(await parseBillUrl()).toEqual(
        expect.objectContaining({
          valid: true,
          destinationDirection: DestinationDirection.Send,
          validDestination: expect.objectContaining({
            paymentType: PaymentType.Lnurl,
            lnurl: billLnurl,
            isMerchant: true,
          }),
        }),
      )
    })
  })
})
