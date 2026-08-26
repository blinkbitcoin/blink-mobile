import axios from "axios"
import { bech32 } from "bech32"
import { LNURLResponse, LNURLWithdrawParams, getParams } from "js-lnurl"
import { requestPayServiceParams, LnUrlPayServiceResponse, Satoshis } from "lnurl-pay"

import {
  createLnurlPaymentDestination,
  resolveLnurlDestination,
} from "@app/screens/send-bitcoin-screen/payment-destination"
import {
  DestinationDirection,
  InvalidDestinationReason,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { createLnurlPaymentDetails } from "@app/screens/send-bitcoin-screen/payment-details"
import { ZeroBtcMoneyAmount } from "@app/types/amounts"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { defaultPaymentDetailParams } from "./helpers"

jest.mock("lnurl-pay", () => ({
  requestPayServiceParams: jest.fn(),
}))

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

jest.mock("js-lnurl", () => ({
  getParams: jest.fn(),
}))

jest.mock("@app/screens/send-bitcoin-screen/payment-details", () => ({
  createLnurlPaymentDetails: jest.fn(),
}))

const mockRequestPayServiceParams = requestPayServiceParams as jest.MockedFunction<
  typeof requestPayServiceParams
>
const mockGetParams = getParams as jest.MockedFunction<typeof getParams>
const mockAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>
const mockCreateLnurlPaymentDetail = createLnurlPaymentDetails as jest.MockedFunction<
  typeof createLnurlPaymentDetails
>

const throwError = () => {
  throw new Error("test error")
}

// Manual mocks for LnUrlPayServiceResponse and LNURLResponse
const manualMockLnUrlPayServiceResponse = (
  identifier: string,
): LnUrlPayServiceResponse => ({
  callback: "https://example.com/callback",
  fixed: true,
  min: 0 as Satoshis,
  max: 2000 as Satoshis,
  domain: "example.com",
  metadata: [
    ["text/plain", "description"],
    ["image/png;base64", "base64EncodedImage"],
  ],
  metadataHash: "mocked_metadata_hash",
  identifier,
  description: "mocked_description",
  image: "mocked_image_url",
  commentAllowed: 140,
  rawData: {},
})

const manualMockLNURLResponse = (): LNURLResponse => ({
  status: "string",
  reason: "string",
  domain: "string",
  url: "string",
})

const manualMockLNURLWithdrawParams = (): LNURLWithdrawParams => ({
  // Example structure. Adjust according to your actual LNURLWithdrawParams type
  tag: "withdrawRequest",
  k1: "some_random_string",
  callback: "https://example.com/callback",
  domain: "example.com",
  maxWithdrawable: 2000,
  minWithdrawable: 0,
  defaultDescription: "Test withdraw",
  // ... add other required properties
})

describe("resolve lnurl destination", () => {
  describe("with ln address", () => {
    const lnurlPaymentDestinationParams = {
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "test@domain.com",
        isMerchant: false,
      } as const,
      lnurlDomains: ["ourdomain.com"],
      accountDefaultWalletQuery: jest.fn(),
      myWalletIds: ["testwalletid"],
    }

    it("creates lnurl pay destination", async () => {
      const lnurlPayParams = manualMockLnUrlPayServiceResponse(
        lnurlPaymentDestinationParams.parsedLnurlDestination.lnurl,
      )

      mockRequestPayServiceParams.mockResolvedValue(lnurlPayParams)
      mockGetParams.mockResolvedValue(manualMockLNURLResponse())

      const destination = await resolveLnurlDestination(lnurlPaymentDestinationParams)

      expect(destination).toEqual(
        expect.objectContaining({
          valid: true,
          destinationDirection: DestinationDirection.Send,
          validDestination: {
            ...lnurlPaymentDestinationParams.parsedLnurlDestination,
            lnurlParams: lnurlPayParams,
            valid: true,
          },
        }),
      )
    })
  })

  describe("with lnurl pay string", () => {
    const lnurlPaymentDestinationParams = {
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "lnurlrandomstring",
        isMerchant: false,
      } as const,
      lnurlDomains: ["ourdomain.com"],
      accountDefaultWalletQuery: jest.fn(),
      myWalletIds: ["testwalletid"],
    }

    it("creates lnurl pay destination", async () => {
      const lnurlPayParams = manualMockLnUrlPayServiceResponse(
        lnurlPaymentDestinationParams.parsedLnurlDestination.lnurl,
      )
      mockRequestPayServiceParams.mockResolvedValue(lnurlPayParams)
      mockGetParams.mockResolvedValue(manualMockLNURLResponse())

      const destination = await resolveLnurlDestination(lnurlPaymentDestinationParams)

      expect(destination).toEqual(
        expect.objectContaining({
          valid: true,
          destinationDirection: DestinationDirection.Send,
          validDestination: {
            ...lnurlPaymentDestinationParams.parsedLnurlDestination,
            lnurlParams: lnurlPayParams,
            valid: true,
          },
        }),
      )
    })
  })

  describe("with lnurl withdraw string", () => {
    const lnurlPaymentDestinationParams = {
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "lnurlrandomstring",
        isMerchant: false,
      } as const,
      lnurlDomains: ["ourdomain.com"],
      accountDefaultWalletQuery: jest.fn(),
      myWalletIds: ["testwalletid"],
    }

    it("creates lnurl withdraw destination", async () => {
      mockRequestPayServiceParams.mockImplementation(throwError)
      const mockLnurlWithdrawParams = manualMockLNURLWithdrawParams()
      mockGetParams.mockResolvedValue(mockLnurlWithdrawParams)

      const destination = await resolveLnurlDestination(lnurlPaymentDestinationParams)

      const {
        callback,
        domain,
        k1,
        maxWithdrawable,
        minWithdrawable,
        defaultDescription,
      } = mockLnurlWithdrawParams

      expect(destination).toEqual(
        expect.objectContaining({
          valid: true,
          destinationDirection: DestinationDirection.Receive,
          validDestination: {
            paymentType: PaymentType.Lnurl,
            callback,
            domain,
            k1,
            maxWithdrawable,
            minWithdrawable,
            defaultDescription,
            valid: true,
            lnurl: lnurlPaymentDestinationParams.parsedLnurlDestination.lnurl,
          },
        }),
      )
    })
  })

  describe("with phone number on our domain", () => {
    const lnurlPaymentDestinationParams = {
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "+254728438158@ourdomain.com",
        isMerchant: false,
      } as const,
      lnurlDomains: ["ourdomain.com"],
      accountDefaultWalletQuery: jest.fn().mockResolvedValue({
        data: {
          accountDefaultWallet: {
            __typename: "BtcWallet",
            id: "recipientwalletid",
            walletCurrency: "BTC",
          },
        },
      }),
      myWalletIds: ["testwalletid"],
    }

    it("resolves phone number as intraledger destination", async () => {
      const lnurlPayParams = manualMockLnUrlPayServiceResponse(
        "+254728438158@ourdomain.com",
      )
      mockRequestPayServiceParams.mockResolvedValue(lnurlPayParams)
      mockGetParams.mockResolvedValue(manualMockLNURLResponse())

      const destination = await resolveLnurlDestination(lnurlPaymentDestinationParams)

      expect(destination).toEqual(
        expect.objectContaining({
          valid: true,
          destinationDirection: DestinationDirection.Send,
        }),
      )
      // Phone number should resolve as intraledger, not fall through to LNURL pay
      if (destination.valid) {
        expect(destination.validDestination).toEqual(
          expect.objectContaining({
            paymentType: PaymentType.Intraledger,
            handle: "+254728438158",
          }),
        )
      }
    })
  })

  describe("with username on our domain", () => {
    const lnurlPaymentDestinationParams = {
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "alice@ourdomain.com",
        isMerchant: false,
      } as const,
      lnurlDomains: ["ourdomain.com"],
      accountDefaultWalletQuery: jest.fn().mockResolvedValue({
        data: {
          accountDefaultWallet: {
            __typename: "BtcWallet",
            id: "recipientwalletid",
            walletCurrency: "BTC",
          },
        },
      }),
      myWalletIds: ["testwalletid"],
    }

    it("resolves username as intraledger destination", async () => {
      const lnurlPayParams = manualMockLnUrlPayServiceResponse("alice@ourdomain.com")
      mockRequestPayServiceParams.mockResolvedValue(lnurlPayParams)
      mockGetParams.mockResolvedValue(manualMockLNURLResponse())

      const destination = await resolveLnurlDestination(lnurlPaymentDestinationParams)

      expect(destination).toEqual(
        expect.objectContaining({
          valid: true,
          destinationDirection: DestinationDirection.Send,
        }),
      )
      if (destination.valid) {
        expect(destination.validDestination).toEqual(
          expect.objectContaining({
            paymentType: PaymentType.Intraledger,
            handle: "alice",
          }),
        )
      }
    })
  })

  describe("with username on external domain", () => {
    const lnurlPaymentDestinationParams = {
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "bob@external.com",
        isMerchant: false,
      } as const,
      lnurlDomains: ["ourdomain.com"],
      accountDefaultWalletQuery: jest.fn(),
      myWalletIds: ["testwalletid"],
    }

    it("creates lnurl pay destination instead of intraledger", async () => {
      const lnurlPayParams = manualMockLnUrlPayServiceResponse("bob@external.com")
      mockRequestPayServiceParams.mockResolvedValue(lnurlPayParams)
      mockGetParams.mockResolvedValue(manualMockLNURLResponse())

      const destination = await resolveLnurlDestination(lnurlPaymentDestinationParams)

      expect(destination).toEqual(
        expect.objectContaining({
          valid: true,
          destinationDirection: DestinationDirection.Send,
          validDestination: expect.objectContaining({
            paymentType: PaymentType.Lnurl,
            lnurlParams: lnurlPayParams,
          }),
        }),
      )
    })
  })

  describe("with phone number on external domain", () => {
    const lnurlPaymentDestinationParams = {
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "+50370000000@external.com",
        isMerchant: false,
      } as const,
      lnurlDomains: ["ourdomain.com"],
      accountDefaultWalletQuery: jest.fn(),
      myWalletIds: ["testwalletid"],
    }

    it("creates lnurl pay destination instead of intraledger", async () => {
      const lnurlPayParams = manualMockLnUrlPayServiceResponse(
        "+50370000000@external.com",
      )
      mockRequestPayServiceParams.mockResolvedValue(lnurlPayParams)
      mockGetParams.mockResolvedValue(manualMockLNURLResponse())

      const destination = await resolveLnurlDestination(lnurlPaymentDestinationParams)

      expect(destination).toEqual(
        expect.objectContaining({
          valid: true,
          destinationDirection: DestinationDirection.Send,
          validDestination: expect.objectContaining({
            paymentType: PaymentType.Lnurl,
            lnurlParams: lnurlPayParams,
          }),
        }),
      )
    })
  })
})

describe("create lnurl destination", () => {
  it("correctly creates payment detail", () => {
    const manualMockLnUrlPayServiceResponse = {
      callback: "mocked_callback",
      fixed: true,
      min: 0 as Satoshis,
      max: 2000 as Satoshis,
      domain: "example.com",
      metadata: [
        ["text/plain", "description"],
        ["image/png;base64", "base64EncodedImage"],
      ],
      metadataHash: "mocked_metadata_hash",
      identifier: "testlnurl",
      description: "mocked_description",
      image: "mocked_image_url",
      commentAllowed: 140,
      rawData: {},
    }

    const lnurlPaymentDestinationParams = {
      paymentType: "lnurl",
      valid: true,
      lnurl: "testlnurl",
      isMerchant: false,
      lnurlParams: manualMockLnUrlPayServiceResponse,
    } as const

    const lnurlPayDestination = createLnurlPaymentDestination(
      lnurlPaymentDestinationParams,
    )

    lnurlPayDestination.createPaymentDetail(defaultPaymentDetailParams)

    expect(mockCreateLnurlPaymentDetail).toBeCalledWith({
      lnurl: lnurlPaymentDestinationParams.lnurl,
      lnurlParams: lnurlPaymentDestinationParams.lnurlParams,
      unitOfAccountAmount: ZeroBtcMoneyAmount,
      convertMoneyAmount: defaultPaymentDetailParams.convertMoneyAmount,
      sendingWalletDescriptor: defaultPaymentDetailParams.sendingWalletDescriptor,
      destinationSpecifiedMemo: lnurlPaymentDestinationParams.lnurlParams.description,
      isMerchant: false,
    })
  })
})

describe("lnurl https enforcement", () => {
  const encodeLnurl = (url: string): string =>
    bech32.encode("lnurl", bech32.toWords(Buffer.from(url, "utf8")), 20000)

  const baseParams = {
    lnurlDomains: ["ourdomain.com"],
    accountDefaultWalletQuery: jest.fn(),
    myWalletIds: ["testwalletid"],
  }

  beforeEach(() => {
    mockRequestPayServiceParams.mockClear()
    mockGetParams.mockClear()
  })

  it("rejects a bare bech32 lnurl that decodes to an http URL before any fetch", async () => {
    const destination = await resolveLnurlDestination({
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: encodeLnurl("http://example.com/lnurl"),
        isMerchant: false,
      },
      ...baseParams,
    })

    expect(destination).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlError,
      }),
    )
    expect(mockGetParams).not.toHaveBeenCalled()
    expect(mockRequestPayServiceParams).not.toHaveBeenCalled()
  })

  it("accepts a bare bech32 lnurl that decodes to an https URL", async () => {
    const lnurl = encodeLnurl("https://example.com/lnurl")
    const lnurlPayParams = manualMockLnUrlPayServiceResponse(lnurl)
    mockRequestPayServiceParams.mockResolvedValue(lnurlPayParams)
    mockGetParams.mockResolvedValue(manualMockLNURLResponse())

    const destination = await resolveLnurlDestination({
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl,
        isMerchant: false,
      },
      ...baseParams,
    })

    expect(mockGetParams).toHaveBeenCalledWith(lnurl)
    expect(destination).toEqual(
      expect.objectContaining({
        valid: true,
        destinationDirection: DestinationDirection.Send,
      }),
    )
  })

  it("rejects a withdraw request whose callback is not https", async () => {
    mockGetParams.mockResolvedValue({
      ...manualMockLNURLWithdrawParams(),
      callback: "http://example.com/callback",
    })

    const destination = await resolveLnurlDestination({
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "lnurlrandomstring",
        isMerchant: false,
      },
      ...baseParams,
    })

    expect(destination).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlError,
      }),
    )
  })

  it("rejects a pay request whose callback is not https", async () => {
    mockGetParams.mockResolvedValue(manualMockLNURLResponse())
    mockRequestPayServiceParams.mockResolvedValue({
      ...manualMockLnUrlPayServiceResponse("bob@external.com"),
      callback: "http://example.com/callback",
    })

    const destination = await resolveLnurlDestination({
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "bob@external.com",
        isMerchant: false,
      },
      ...baseParams,
    })

    expect(destination).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlError,
      }),
    )
  })

  it("rejects a lnurl1 string it cannot decode instead of passing it through unchecked", async () => {
    const destination = await resolveLnurlDestination({
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "lnurl1qqqqqq",
        isMerchant: false,
      },
      ...baseParams,
    })

    expect(destination).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlError,
      }),
    )
    expect(mockGetParams).not.toHaveBeenCalled()
    expect(mockRequestPayServiceParams).not.toHaveBeenCalled()
  })

  it("rejects a LUD-17 lnurlw URI whose payload contains .onion (cleartext http downgrade)", async () => {
    const destination = await resolveLnurlDestination({
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "lnurlw://attacker.com/w/.onion/x",
        isMerchant: false,
      },
      ...baseParams,
    })

    expect(destination).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlError,
      }),
    )
    expect(mockGetParams).not.toHaveBeenCalled()
    expect(mockRequestPayServiceParams).not.toHaveBeenCalled()
  })

  it("rejects a LUD-17 lnurlp URI whose .onion is followed by a word character", async () => {
    const destination = await resolveLnurlDestination({
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "lnurlp://attacker.com/x.onionz",
        isMerchant: false,
      },
      ...baseParams,
    })

    expect(destination).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlError,
      }),
    )
    expect(mockGetParams).not.toHaveBeenCalled()
    expect(mockRequestPayServiceParams).not.toHaveBeenCalled()
  })

  it("accepts a LUD-17 lnurlw URI over a clearnet host (derived URL is https)", async () => {
    const lnurl = "lnurlw://example.com/withdraw"
    mockGetParams.mockResolvedValue(manualMockLNURLWithdrawParams())

    const destination = await resolveLnurlDestination({
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl,
        isMerchant: false,
      },
      ...baseParams,
    })

    expect(mockGetParams).toHaveBeenCalledWith(lnurl)
    expect(destination).toEqual(
      expect.objectContaining({
        valid: true,
        destinationDirection: DestinationDirection.Receive,
      }),
    )
  })
})

/**
 * A merchant till code is an ordinary lnurl pay address pointed at the merchant's
 * service, so every failure that service can have arrives through this one call.
 * Folding it into LnurlUnsupported told the user their code was not a Bitcoin
 * address or Lightning invoice at all, which is what #1175 was filed as.
 */
describe("lnurl service failures", () => {
  const merchantLnurl = "https%3A%2F%2Fmerchant.example%2Fbill%2F1@codes.example"

  const merchant = {
    id: "example-tills",
    lnurl: merchantLnurl,
    category: "merchant-payment" as const,
    title: "Example Tills",
    description: "Example merchant",
    companyName: "Example",
    termsUrl: "https://merchant.example/terms",
    displayCurrency: "ZAR",
  }

  const baseParams = {
    lnurlDomains: ["ourdomain.com"],
    accountDefaultWalletQuery: jest.fn(),
    myWalletIds: ["testwalletid"],
  }

  const resolveMerchantLnurl = () =>
    resolveLnurlDestination({
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: merchantLnurl,
        isMerchant: true,
        merchant,
      },
      ...baseParams,
    })

  beforeEach(() => {
    mockRequestPayServiceParams.mockReset()
    mockGetParams.mockReset()
    mockGetParams.mockResolvedValue(manualMockLNURLResponse())
  })

  const httpError = (status: number) =>
    Object.assign(new Error(`Request failed with status code ${status}`), {
      response: { status },
    })

  it("reports a service that failed on its own side as a service error", async () => {
    mockRequestPayServiceParams.mockRejectedValue(httpError(500))

    expect(await resolveMerchantLnurl()).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlServiceError,
      }),
    )
  })

  it("reports a service that is down for maintenance as a service error", async () => {
    mockRequestPayServiceParams.mockRejectedValue(httpError(503))

    expect(await resolveMerchantLnurl()).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlServiceError,
      }),
    )
  })

  /**
   * A 404 is the service answering, and answering that this destination does not
   * exist. Telling the user to try again later would be a lie, and it is the answer
   * a mistyped lightning address gets.
   */
  /**
   * Not hypothetical: blink's own swap provider answers HTTP 200 with
   * {"status":"ERROR","reason":"swap provider unavailable"} while it is down, and a
   * scan of a swap merchant code landed on "Enter a valid destination" until the
   * resolver started reading the body rather than only the HTTP status.
   */
  it("reports a service that announces its own outage in the body as a service error", async () => {
    mockAxiosGet.mockResolvedValue({
      data: { status: "ERROR", reason: "swap provider unavailable" },
    })
    mockRequestPayServiceParams.mockImplementation(async ({ fetchGet }) => {
      await fetchGet?.({ url: "https://swap.example/.well-known/lnurlp/x" })
      throw new Error("unreachable: the fetcher rejects on an ERROR body")
    })

    expect(await resolveMerchantLnurl()).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlServiceError,
      }),
    )
  })

  /**
   * How an outage actually reaches us: refused, DNS, TLS or timeout, so the request
   * was made and nothing came back. Nothing about the destination was established.
   */
  it("reports a service that never answered as a service error", async () => {
    mockRequestPayServiceParams.mockRejectedValue(
      Object.assign(new Error("Network Error"), { request: {}, code: "ERR_NETWORK" }),
    )

    expect(await resolveMerchantLnurl()).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlServiceError,
      }),
    )
  })

  it("keeps reporting a destination the service does not know as unsupported", async () => {
    mockRequestPayServiceParams.mockRejectedValue(httpError(404))

    expect(await resolveMerchantLnurl()).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlUnsupported,
      }),
    )
  })

  it("keeps reporting an address the library rejects outright as unsupported", async () => {
    mockRequestPayServiceParams.mockRejectedValue(new Error("Invalid lnUrlOrAddress"))

    expect(await resolveMerchantLnurl()).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlUnsupported,
      }),
    )
  })

  /**
   * What an lnurl-auth or channel-request QR resolves to: the service answers, with
   * something that is not a pay request. Blink can never pay it, so "try again
   * later" would be wrong however many times the user retries.
   */
  it("keeps reporting a response that is not a pay request as unsupported", async () => {
    mockRequestPayServiceParams.mockRejectedValue(new Error("Invalid pay service params"))

    expect(await resolveMerchantLnurl()).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlUnsupported,
      }),
    )
  })

  /**
   * The account lookup behind an lnurl is a separate request against our own backend.
   * It failing is not the merchant service failing, so it must not be reported as one.
   */
  it("keeps reporting a failed account lookup as unsupported", async () => {
    mockRequestPayServiceParams.mockResolvedValue(
      manualMockLnUrlPayServiceResponse("someone@ourdomain.com"),
    )
    baseParams.accountDefaultWalletQuery.mockRejectedValue(new Error("network down"))

    expect(await resolveMerchantLnurl()).toEqual(
      expect.objectContaining({
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlUnsupported,
      }),
    )
  })

  it("still resolves a merchant code the service can answer", async () => {
    mockRequestPayServiceParams.mockResolvedValue(
      manualMockLnUrlPayServiceResponse(merchantLnurl),
    )

    expect(await resolveMerchantLnurl()).toEqual(
      expect.objectContaining({
        valid: true,
        destinationDirection: DestinationDirection.Send,
      }),
    )
  })
})
