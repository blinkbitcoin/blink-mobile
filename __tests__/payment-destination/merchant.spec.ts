import { Network } from "@app/graphql/generated"
import { parseDestination } from "@app/screens/send-bitcoin-screen/payment-destination"
import { resolveMerchantChoiceDestination } from "@app/screens/send-bitcoin-screen/payment-destination/merchant"
import {
  DestinationDirection,
  isMerchantChoiceDestination,
  MerchantPaymentType,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { getParams } from "js-lnurl"
import { requestPayServiceParams, Satoshis } from "lnurl-pay"
import { parsePaymentDestination, PaymentType } from "@blinkbitcoin/blink-client"

jest.mock("@blinkbitcoin/blink-client", () => ({
  ...jest.requireActual("@blinkbitcoin/blink-client"),
  parsePaymentDestination: jest.fn(),
}))

jest.mock("lnurl-pay", () => ({
  ...jest.requireActual("lnurl-pay"),
  requestPayServiceParams: jest.fn(),
}))

jest.mock("js-lnurl", () => ({
  getParams: jest.fn(),
}))

const parsePaymentDestinationMock = parsePaymentDestination as jest.MockedFunction<
  typeof parsePaymentDestination
>
const mockWrapDestination = jest.fn()
const requestPayServiceParamsMock = requestPayServiceParams as jest.MockedFunction<
  typeof requestPayServiceParams
>
const getParamsMock = getParams as jest.MockedFunction<typeof getParams>

jest.mock("@app/self-custodial/payment-details/wrap-destination", () => ({
  wrapDestination: (...args: unknown[]) => mockWrapDestination(...args),
}))

describe("merchant payment destinations", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWrapDestination.mockImplementation((result) => result)
    getParamsMock.mockResolvedValue({ status: "OK" } as never)
  })

  it("preserves multiple merchant choices for user selection", async () => {
    const merchants = [
      {
        id: "blink-boltz-usdc-arbitrum",
        lnurl: "0x52908400098527886E0F7030069857D2E4169EE7+USDC+Arbitrum@swap.blink.sv",
        category: "swap",
        title: "USDC on Arbitrum",
        description: "Swap USDC on Arbitrum to Bitcoin",
        companyName: "Blink",
        termsUrl: "https://blink.sv/terms",
        displayCurrency: "USD",
      },
      {
        id: "blink-boltz-usdt-ethereum",
        lnurl: "0x52908400098527886E0F7030069857D2E4169EE7+USDT+Ethereum@swap.blink.sv",
        category: "swap",
        title: "USDT on Ethereum",
        description: "Swap USDT on Ethereum to Bitcoin",
        companyName: "Blink",
        termsUrl: "https://blink.sv/terms",
      },
    ]

    parsePaymentDestinationMock.mockReturnValue({
      paymentType: MerchantPaymentType,
      merchants,
    } as ReturnType<typeof parsePaymentDestination>)

    const result = await parseDestination({
      rawInput: "0x52908400098527886E0F7030069857D2E4169EE7",
      myWalletIds: ["wallet-id"],
      bitcoinNetwork: Network.Mainnet,
      lnurlDomains: ["blink.sv"],
      accountDefaultWalletQuery: jest.fn() as never,
      displayCurrency: "USD",
    })

    expect(result).toEqual({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: {
        paymentType: MerchantPaymentType,
        merchants,
      },
    })
    expect(isMerchantChoiceDestination(result)).toBe(true)
  })

  it("auto-selects a single merchant choice and continues through LNURL", async () => {
    const merchant = {
      id: "blink-boltz-usdt-tron",
      lnurl: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb+USDT+Tron@swap.blink.sv",
      category: "swap" as const,
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
      identifier: merchant.lnurl,
      description: "mocked_description",
      image: "",
      commentAllowed: 0,
      rawData: {},
    }

    parsePaymentDestinationMock.mockReturnValue({
      paymentType: MerchantPaymentType,
      merchants: [merchant],
    } as ReturnType<typeof parsePaymentDestination>)
    requestPayServiceParamsMock.mockResolvedValue(lnurlParams)

    const result = await parseDestination({
      rawInput: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
      myWalletIds: ["wallet-id"],
      bitcoinNetwork: Network.Mainnet,
      lnurlDomains: ["blink.sv"],
      accountDefaultWalletQuery: jest.fn() as never,
      displayCurrency: "USD",
    })

    expect(requestPayServiceParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({ lnUrlOrAddress: merchant.lnurl }),
    )
    expect(isMerchantChoiceDestination(result)).toBe(false)
    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: expect.objectContaining({
          paymentType: PaymentType.Lnurl,
          lnurl: merchant.lnurl,
          isMerchant: true,
          merchant,
          lnurlParams,
        }),
      }),
    )
  })

  it("wraps selected merchant LNURL destinations for self-custodial sends", async () => {
    const merchant = {
      id: "blink-boltz-usdc-arbitrum",
      lnurl: "0x52908400098527886E0F7030069857D2E4169EE7+USDC+Arbitrum@swap.blink.sv",
      category: "swap" as const,
      title: "USDC Arbitrum",
      description: "Swap sats to USDC on Arbitrum",
      companyName: "Boltz",
      termsUrl: "https://boltz.exchange/terms",
    }
    const sdk = { id: "spark-sdk" } as never
    const wrapped = { valid: true, wrapped: true }
    const lnurlParams = {
      callback: "https://example.com/callback",
      fixed: true,
      min: 0 as Satoshis,
      max: 2000 as Satoshis,
      domain: "swap.blink.sv",
      metadata: [["text/plain", "description"]],
      metadataHash: "mocked_metadata_hash",
      identifier: merchant.lnurl,
      description: "mocked_description",
      image: "",
      commentAllowed: 0,
      rawData: {},
    }
    requestPayServiceParamsMock.mockResolvedValue(lnurlParams)
    mockWrapDestination.mockReturnValue(wrapped)

    const result = await resolveMerchantChoiceDestination({
      merchant,
      params: {
        rawInput: merchant.lnurl,
        myWalletIds: ["wallet-id"],
        bitcoinNetwork: Network.Mainnet,
        lnurlDomains: ["blink.sv"],
        accountDefaultWalletQuery: jest.fn() as never,
        displayCurrency: "USD",
      },
      sdk,
    })

    expect(mockWrapDestination).toHaveBeenCalledWith(
      expect.objectContaining({
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: expect.objectContaining({
          paymentType: PaymentType.Lnurl,
          lnurl: merchant.lnurl,
          isMerchant: true,
          merchant,
          lnurlParams,
        }),
      }),
      sdk,
    )
    expect(result).toBe(wrapped)
  })
})
