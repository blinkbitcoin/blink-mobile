import { Network } from "@app/graphql/generated"
import { parseDestination } from "@app/screens/send-bitcoin-screen/payment-destination"
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
      callback: "mocked_callback",
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

    expect(requestPayServiceParamsMock).toHaveBeenCalledWith({
      lnUrlOrAddress: expectedMerchant.lnurl,
    })
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
})
