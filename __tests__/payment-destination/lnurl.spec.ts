import { LNURLResponse, LNURLWithdrawParams, getParams } from "js-lnurl"
import { requestPayServiceParams, LnUrlPayServiceResponse, Satoshis } from "lnurl-pay"

import {
  createLnurlPaymentDestination,
  resolveLnurlDestination,
} from "@app/screens/send-bitcoin-screen/payment-destination"
import { DestinationDirection } from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { createLnurlPaymentDetails } from "@app/screens/send-bitcoin-screen/payment-details"
import { ZeroBtcMoneyAmount } from "@app/types/amounts"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { defaultPaymentDetailParams } from "./helpers"

jest.mock("lnurl-pay", () => ({
  requestPayServiceParams: jest.fn(),
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
  callback: "http://example.com/callback",
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

    it("still resolves lnurl pay when getParams throws", async () => {
      const lnurlPayParams = manualMockLnUrlPayServiceResponse(
        lnurlPaymentDestinationParams.parsedLnurlDestination.lnurl,
      )
      mockRequestPayServiceParams.mockResolvedValue(lnurlPayParams)
      mockGetParams.mockImplementation(throwError)

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

  describe("with lnurl auth string", () => {
    const lnurlPaymentDestinationParams = {
      parsedLnurlDestination: {
        paymentType: PaymentType.Lnurl,
        valid: true,
        lnurl: "lnurlauthstring",
        isMerchant: false,
      } as const,
      lnurlDomains: ["ourdomain.com"],
      accountDefaultWalletQuery: jest.fn(),
      myWalletIds: ["testwalletid"],
    }

    it("creates lnurl auth destination with login action", async () => {
      mockRequestPayServiceParams.mockImplementation(throwError)
      const mockLnurlAuthParams = {
        tag: "login" as const,
        k1: "e2af6254a8df433264fa23f67eb8188635d15ce883e8fc020989d5f82ae6f11e",
        callback: "https://example.com/auth",
        domain: "example.com",
      }
      mockGetParams.mockResolvedValue(mockLnurlAuthParams)

      const destination = await resolveLnurlDestination(lnurlPaymentDestinationParams)

      expect(destination).toEqual(
        expect.objectContaining({
          valid: true,
          destinationDirection: DestinationDirection.Receive,
          validDestination: {
            paymentType: PaymentType.Lnurl,
            callback: mockLnurlAuthParams.callback,
            domain: mockLnurlAuthParams.domain,
            k1: mockLnurlAuthParams.k1,
            action: "login",
            valid: true,
            lnurl: lnurlPaymentDestinationParams.parsedLnurlDestination.lnurl,
          },
        }),
      )
    })

    it("creates lnurl auth destination with register action", async () => {
      mockRequestPayServiceParams.mockImplementation(throwError)
      const mockLnurlAuthParams = {
        tag: "login" as const,
        k1: "e2af6254a8df433264fa23f67eb8188635d15ce883e8fc020989d5f82ae6f11e",
        callback: "https://example.com/auth",
        domain: "example.com",
        action: "register" as const,
      }
      mockGetParams.mockResolvedValue(mockLnurlAuthParams)

      const destination = await resolveLnurlDestination(lnurlPaymentDestinationParams)

      expect(destination).toEqual(
        expect.objectContaining({
          valid: true,
          destinationDirection: DestinationDirection.Receive,
          validDestination: expect.objectContaining({
            action: "register",
          }),
        }),
      )
    })

    it("defaults to login action when lnurl auth action is unsupported", async () => {
      mockRequestPayServiceParams.mockImplementation(throwError)
      const mockLnurlAuthParams = {
        tag: "login" as const,
        k1: "e2af6254a8df433264fa23f67eb8188635d15ce883e8fc020989d5f82ae6f11e",
        callback: "https://example.com/auth",
        domain: "example.com",
        action: "unsupported-action",
      }
      mockGetParams.mockResolvedValue(mockLnurlAuthParams)

      const destination = await resolveLnurlDestination(lnurlPaymentDestinationParams)

      expect(destination).toEqual(
        expect.objectContaining({
          valid: true,
          destinationDirection: DestinationDirection.Receive,
          validDestination: expect.objectContaining({
            action: "login",
          }),
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
