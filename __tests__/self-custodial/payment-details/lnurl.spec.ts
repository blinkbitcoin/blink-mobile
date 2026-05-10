/* eslint-disable camelcase */
import { LnUrlPayServiceResponse, Satoshis } from "lnurl-pay"

import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { createSelfCustodialLnurlPaymentDetails } from "@app/self-custodial/payment-details/lnurl"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

const mockPrepareLnurl = jest.fn()
const mockExecuteLnurl = jest.fn()
const mockExtractLnurlFee = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  prepareLnurl: (...args: unknown[]) => mockPrepareLnurl(...args),
  executeLnurl: (...args: unknown[]) => mockExecuteLnurl(...args),
  extractLnurlFee: (...args: unknown[]) => mockExtractLnurlFee(...args),
  buildConversionType: jest.fn().mockReturnValue({ tag: "ToBitcoin" }),
  resolveSendTokenIdentifier: (currency: WalletCurrency) =>
    currency === WalletCurrency.Usd ? "usdb-token-id" : undefined,
  toSdkSendAmount: (amount: number, currency: WalletCurrency) =>
    currency === WalletCurrency.Usd ? BigInt(amount * 10000) : BigInt(amount),
}))

jest.mock("@app/self-custodial/sdk-error", () => {
  const tags = {
    SparkError: "SparkError",
    InsufficientFunds: "InsufficientFunds",
    InvalidUuid: "InvalidUuid",
    InvalidInput: "InvalidInput",
    NetworkError: "NetworkError",
    StorageError: "StorageError",
    ChainServiceError: "ChainServiceError",
    MaxDepositClaimFeeExceeded: "MaxDepositClaimFeeExceeded",
    MissingUtxo: "MissingUtxo",
    LnurlError: "LnurlError",
    Signer: "Signer",
    Generic: "Generic",
  }
  return {
    SelfCustodialErrorCode: {
      InsufficientFunds: "sc_insufficient_funds",
      BelowMinimum: "sc_below_minimum",
      NetworkError: "sc_network_error",
      InvalidInput: "sc_invalid_input",
      Generic: "sc_generic",
    },
    classifySdkError: (err: { tag?: string } | unknown) => {
      const t = (err as { tag?: string })?.tag
      if (t === tags.LnurlError) return "sc_invalid_input"
      if (t === tags.NetworkError) return "sc_network_error"
      return "sc_generic"
    },
  }
})

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  AesSuccessActionDataResult_Tags: { Decrypted: "Decrypted", ErrorStatus: "ErrorStatus" },
  FeePolicy: { FeesExcluded: 0, FeesIncluded: 1 },
  SuccessActionProcessed_Tags: { Aes: "Aes", Message: "Message", Url: "Url" },
}))

const baseLnurlParams = (overrides: Partial<LnUrlPayServiceResponse> = {}) =>
  ({
    callback: "https://example.com/cb",
    fixed: false,
    min: 1 as Satoshis,
    max: 100000 as Satoshis,
    domain: "example.com",
    metadata: [["text/plain", "Test"]],
    metadataHash: "",
    identifier: "user@example.com",
    description: "Test description",
    image: "",
    commentAllowed: 0,
    rawData: { metadata: '[["text/plain","Test"]]' },
    ...overrides,
  }) as LnUrlPayServiceResponse

const convertMoneyAmount = jest.fn((amount, target) => ({
  amount: amount.amount,
  currency: target,
  currencyCode: target,
}))

const createParams = (overrides = {}) => ({
  sdk: {} as never,
  lnurl: "lnurl1abc",
  lnurlParams: baseLnurlParams(),
  unitOfAccountAmount: {
    amount: 1500,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  },
  isMerchant: false,
  convertMoneyAmount,
  sendingWalletDescriptor: { id: "w1", currency: WalletCurrency.Btc },
  ...overrides,
})

describe("createSelfCustodialLnurlPaymentDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    convertMoneyAmount.mockImplementation((amount, target) => ({
      amount: amount.amount,
      currency: target,
      currencyCode: target,
    }))
    mockExtractLnurlFee.mockReturnValue(5)
  })

  it("returns Lnurl payment type", () => {
    const detail = createSelfCustodialLnurlPaymentDetails(createParams())
    expect(detail.paymentType).toBe(PaymentType.Lnurl)
  })

  it("sets destination to the lnurl string", () => {
    const detail = createSelfCustodialLnurlPaymentDetails(createParams())
    expect(detail.destination).toBe("lnurl1abc")
  })

  it("propagates lnurlParams + isMerchant + setInvoice + setSuccessAction (lnurl-specific shape)", () => {
    const detail = createSelfCustodialLnurlPaymentDetails(
      createParams({ isMerchant: true }),
    )
    if (detail.paymentType !== PaymentType.Lnurl) throw new Error("expected lnurl")
    expect(detail.lnurlParams).toBeDefined()
    expect(detail.isMerchant).toBe(true)
    expect(detail.setInvoice).toBeDefined()
    expect(detail.setSuccessAction).toBeDefined()
  })

  describe("amount handling", () => {
    it("locks the amount when min === max (destination-specified amount)", () => {
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({
          lnurlParams: baseLnurlParams({ min: 5000 as Satoshis, max: 5000 as Satoshis }),
        }),
      )
      expect(detail.canSetAmount).toBe(false)
      expect(detail.destinationSpecifiedAmount).toEqual(
        expect.objectContaining({ amount: 5000, currency: WalletCurrency.Btc }),
      )
    })

    it("allows amount changes when min !== max", () => {
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      expect(detail.canSetAmount).toBe(true)
    })

    it("setAmount returns a new detail with the updated amount", () => {
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSetAmount) throw new Error("expected canSetAmount=true")
      const newAmount = {
        amount: 2000,
        currency: WalletCurrency.Btc,
        currencyCode: WalletCurrency.Btc,
      }
      const updated = detail.setAmount(newAmount)
      expect(updated.unitOfAccountAmount).toEqual(newAmount)
    })
  })

  describe("memo handling", () => {
    it("uses lnurl description as the destination-specified memo by default", () => {
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({ destinationSpecifiedMemo: "Test description" }),
      )
      expect(detail.memo).toBe("Test description")
    })

    it("sender memo wins when no destination memo is given", () => {
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({ senderSpecifiedMemo: "user note" }),
      )
      expect(detail.memo).toBe("user note")
    })

    it("setMemo returns a new detail with the updated memo", () => {
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSetMemo) throw new Error("expected canSetMemo")
      const updated = detail.setMemo("new memo")
      expect(updated.memo).toBe("new memo")
    })
  })

  describe("prepareLnurl options (currency-aware shape)", () => {
    it("USD wallet: passes USDB base units + tokenIdentifier + ToBitcoin + FeesIncluded", async () => {
      mockPrepareLnurl.mockResolvedValue({})
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({
          sendingWalletDescriptor: { id: "w-usd", currency: WalletCurrency.Usd },
          unitOfAccountAmount: {
            amount: 100,
            currency: WalletCurrency.Usd,
            currencyCode: "USD",
          },
        }),
      )
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      await detail.getFee({} as never)

      expect(mockPrepareLnurl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          amount: BigInt(1000000),
          tokenIdentifier: "usdb-token-id",
          conversionOptions: expect.objectContaining({
            conversionType: { tag: "ToBitcoin" },
          }),
          feePolicy: 1,
        }),
      )
    })

    it("BTC wallet: passes amount in sats + no tokenIdentifier + no conversionOptions + no feePolicy", async () => {
      mockPrepareLnurl.mockResolvedValue({})
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      await detail.getFee({} as never)

      expect(mockPrepareLnurl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          amount: BigInt(1500),
          tokenIdentifier: undefined,
          conversionOptions: undefined,
          feePolicy: undefined,
        }),
      )
    })

    it("includes the comment only when commentAllowed > 0 and a memo is set", async () => {
      mockPrepareLnurl.mockResolvedValue({})
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({
          lnurlParams: baseLnurlParams({ commentAllowed: 200 }),
          senderSpecifiedMemo: "with comment",
        }),
      )
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      await detail.getFee({} as never)

      expect(mockPrepareLnurl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ comment: "with comment" }),
      )
    })

    it("omits the comment when commentAllowed is 0 even if a memo is set", async () => {
      mockPrepareLnurl.mockResolvedValue({})
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({
          lnurlParams: baseLnurlParams({ commentAllowed: 0 }),
          senderSpecifiedMemo: "would-be comment",
        }),
      )
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      await detail.getFee({} as never)

      expect(mockPrepareLnurl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ comment: undefined }),
      )
    })
  })

  describe("getFee", () => {
    it("returns the fee in BTC sats from extractLnurlFee", async () => {
      mockPrepareLnurl.mockResolvedValue({})
      mockExtractLnurlFee.mockReturnValue(5)
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      const result = await detail.getFee({} as never)
      expect(result.amount?.amount).toBe(5)
      expect(result.amount?.currency).toBe(WalletCurrency.Btc)
    })

    it("returns undefined amount when prepareLnurl throws", async () => {
      mockPrepareLnurl.mockRejectedValue(new Error("boom"))
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      const result = await detail.getFee({} as never)
      expect(result.amount).toBeUndefined()
    })
  })

  describe("sendPaymentMutation", () => {
    it("returns Success with successAction in extraInfo on success (Message)", async () => {
      mockPrepareLnurl.mockResolvedValue({})
      mockExecuteLnurl.mockResolvedValue({
        payment: { id: "p1" },
        successAction: { tag: "Message", inner: { data: { message: "Thanks!" } } },
      })
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const result = await detail.sendPaymentMutation({} as never)
      expect(result.status).toBe(PaymentSendResult.Success)
      expect(result.extraInfo?.successAction?.tag).toBe("message")
      expect(result.extraInfo?.successAction?.message).toBe("Thanks!")
    })

    it("converts a URL successAction to the lnurl-pay shape", async () => {
      mockPrepareLnurl.mockResolvedValue({})
      mockExecuteLnurl.mockResolvedValue({
        payment: { id: "p1" },
        successAction: {
          tag: "Url",
          inner: { data: { description: "Receipt", url: "https://r.example/1" } },
        },
      })
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const result = await detail.sendPaymentMutation({} as never)
      expect(result.extraInfo?.successAction?.tag).toBe("url")
      expect(result.extraInfo?.successAction?.url).toBe("https://r.example/1")
      expect(result.extraInfo?.successAction?.description).toBe("Receipt")
    })

    it("carries the decrypted plaintext on `message` (not via decipher) for AES Decrypted", async () => {
      mockPrepareLnurl.mockResolvedValue({})
      mockExecuteLnurl.mockResolvedValue({
        payment: { id: "p1" },
        successAction: {
          tag: "Aes",
          inner: {
            result: {
              tag: "Decrypted",
              inner: { data: { description: "AES desc", plaintext: "secret123" } },
            },
          },
        },
      })
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const result = await detail.sendPaymentMutation({} as never)
      const successAction = result.extraInfo?.successAction
      expect(successAction?.tag).toBe("aes")
      expect(successAction?.message).toBe("secret123")
      expect(successAction?.description).toBe("AES desc")
      expect(successAction?.ciphertext).toBeNull()
      expect(successAction?.iv).toBeNull()
      expect(successAction?.decipher("any-preimage")).toBeNull()
    })

    it("maps AES ErrorStatus to description with no plaintext leakage", async () => {
      mockPrepareLnurl.mockResolvedValue({})
      mockExecuteLnurl.mockResolvedValue({
        payment: { id: "p1" },
        successAction: {
          tag: "Aes",
          inner: {
            result: {
              tag: "ErrorStatus",
              inner: { reason: "Could not decrypt: bad key" },
            },
          },
        },
      })
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const result = await detail.sendPaymentMutation({} as never)
      const successAction = result.extraInfo?.successAction
      expect(successAction?.tag).toBe("aes")
      expect(successAction?.message).toBeNull()
      expect(successAction?.description).toBe("Could not decrypt: bad key")
      expect(successAction?.decipher("any-preimage")).toBeNull()
    })

    it("returns Failure with classifier code on SDK error", async () => {
      mockPrepareLnurl.mockRejectedValue({ tag: "LnurlError", inner: ["bad"] })
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const result = await detail.sendPaymentMutation({} as never)
      expect(result.status).toBe(PaymentSendResult.Failure)
      expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.InvalidInput)
    })
  })

  describe("idempotency key forwarding", () => {
    let randomUUIDMock: jest.SpyInstance

    beforeEach(() => {
      let counter = 0
      // Override the global mock so each call returns a fresh UUID; the global
      // mock returns the same string and would mask a missing thread-through.
      randomUUIDMock = jest
        .spyOn(
          jest.requireMock("react-native-quick-crypto").default as {
            randomUUID: () => string
          },
          "randomUUID",
        )
        .mockImplementation(() => {
          counter += 1
          return `uuid-${counter}`
        })
    })

    afterEach(() => {
      randomUUIDMock.mockRestore()
    })

    it("forwards a defined idempotency key to executeLnurl on every send", async () => {
      mockPrepareLnurl.mockResolvedValue({ feeSats: BigInt(0) })
      mockExecuteLnurl.mockResolvedValue({
        payment: { id: "p1" },
        successAction: undefined,
      })
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")

      await detail.sendPaymentMutation({} as never)

      expect(mockExecuteLnurl).toHaveBeenCalledTimes(1)
      const idempotencyKey = mockExecuteLnurl.mock.calls[0][2]
      expect(typeof idempotencyKey).toBe("string")
      expect(idempotencyKey.length).toBeGreaterThan(0)
    })

    it("reuses the same idempotency key across retries within the same paymentDetail", async () => {
      mockPrepareLnurl.mockResolvedValue({ feeSats: BigInt(0) })
      mockExecuteLnurl.mockResolvedValue({
        payment: { id: "p1" },
        successAction: undefined,
      })
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")

      await detail.sendPaymentMutation({} as never)
      await detail.sendPaymentMutation({} as never)

      const firstKey = mockExecuteLnurl.mock.calls[0][2]
      const secondKey = mockExecuteLnurl.mock.calls[1][2]
      expect(firstKey).toBe(secondKey)
    })

    it("preserves the idempotency key across setMemo / setAmount / setSendingWalletDescriptor recreations", async () => {
      mockPrepareLnurl.mockResolvedValue({ feeSats: BigInt(0) })
      mockExecuteLnurl.mockResolvedValue({
        payment: { id: "p1" },
        successAction: undefined,
      })
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      if (!detail.canSetAmount) throw new Error("expected canSetAmount")
      if (!detail.canSetMemo) throw new Error("expected canSetMemo")
      await detail.sendPaymentMutation({} as never)
      const originalKey = mockExecuteLnurl.mock.calls[0][2]

      const reMemoed = detail.setMemo("new memo")
      if (!reMemoed.canSendPayment) throw new Error("expected canSendPayment")
      await reMemoed.sendPaymentMutation({} as never)
      expect(mockExecuteLnurl.mock.calls[1][2]).toBe(originalKey)

      if (!reMemoed.canSetAmount) throw new Error("expected canSetAmount")
      const reAmounted = reMemoed.setAmount({
        amount: 2000,
        currency: WalletCurrency.Btc,
        currencyCode: WalletCurrency.Btc,
      })
      if (!reAmounted.canSendPayment) throw new Error("expected canSendPayment")
      await reAmounted.sendPaymentMutation({} as never)
      expect(mockExecuteLnurl.mock.calls[2][2]).toBe(originalKey)

      const reWalleted = reAmounted.setSendingWalletDescriptor({
        id: "w-btc-2",
        currency: WalletCurrency.Btc,
      })
      if (!reWalleted.canSendPayment) throw new Error("expected canSendPayment")
      await reWalleted.sendPaymentMutation({} as never)
      expect(mockExecuteLnurl.mock.calls[3][2]).toBe(originalKey)
    })
  })

  describe("metadataStr preservation (LUD-06 description hash)", () => {
    it("uses the raw metadata string from lnurlParams.rawData when available", async () => {
      mockPrepareLnurl.mockResolvedValue({})
      const rawMetadata = '[ ["text/plain","Spaces in raw"] ]'
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({
          lnurlParams: baseLnurlParams({
            rawData: { metadata: rawMetadata },
            metadata: [["text/plain", "Spaces in raw"]],
          }),
        }),
      )
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      await detail.getFee({} as never)

      expect(mockPrepareLnurl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          payRequest: expect.objectContaining({ metadataStr: rawMetadata }),
        }),
      )
    })

    it("falls back to JSON.stringify when rawData.metadata is missing", async () => {
      mockPrepareLnurl.mockResolvedValue({})
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({
          lnurlParams: baseLnurlParams({ rawData: {} }),
        }),
      )
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      await detail.getFee({} as never)

      expect(mockPrepareLnurl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          payRequest: expect.objectContaining({
            metadataStr: '[["text/plain","Test"]]',
          }),
        }),
      )
    })
  })

  describe("min/max → millisats conversion in payRequest", () => {
    it("multiplies sat values by 1000 to produce SDK-shaped millisats", async () => {
      mockPrepareLnurl.mockResolvedValue({})
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({
          lnurlParams: baseLnurlParams({ min: 100 as Satoshis, max: 200 as Satoshis }),
        }),
      )
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      await detail.getFee({} as never)

      expect(mockPrepareLnurl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          payRequest: expect.objectContaining({
            minSendable: BigInt(100000),
            maxSendable: BigInt(200000),
          }),
        }),
      )
    })
  })
})
