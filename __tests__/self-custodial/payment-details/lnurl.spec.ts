/* eslint-disable camelcase */
import { LnUrlPayServiceResponse, Satoshis } from "lnurl-pay"

import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { createSelfCustodialLnurlPaymentDetails } from "@app/self-custodial/payment-details/lnurl"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

const mockPrepareLnurl = jest.fn()
const mockExecuteLnurl = jest.fn()
const mockExtractLnurlFee = jest.fn()
const mockListSentPaymentsSince = jest.fn()
const mockSyncSelfCustodialWallet = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  prepareLnurl: (...args: unknown[]) => mockPrepareLnurl(...args),
  executeLnurl: (...args: unknown[]) => mockExecuteLnurl(...args),
  extractLnurlFee: (...args: unknown[]) => mockExtractLnurlFee(...args),
  listSentPaymentsSince: (...args: unknown[]) => mockListSentPaymentsSince(...args),
  syncSelfCustodialWallet: (...args: unknown[]) => mockSyncSelfCustodialWallet(...args),
  buildConversionType: jest.fn().mockReturnValue({ tag: "ToBitcoin" }),
  resolveSendTokenIdentifier: (currency: WalletCurrency) =>
    currency === WalletCurrency.Usd ? "usdb-token-id" : undefined,
  toSdkSendAmount: (amount: number, currency: WalletCurrency) =>
    currency === WalletCurrency.Usd ? BigInt(amount * 10000) : BigInt(amount),
}))

/** The lookup for a send whose outcome the SDK lost lives in the shared helpers, which
 *  have their own spec; here only when it is asked, and what is done with its answer. */
const mockFindLostSend = jest.fn()

jest.mock("@app/self-custodial/payment-details/send-helpers", () => ({
  ...jest.requireActual("@app/self-custodial/payment-details/send-helpers"),
  findLostSend: (...args: unknown[]) => mockFindLostSend(...args),
}))

/** The real lookup, for the tests that run it against a history shaped the way the
 *  wallet writes it. Its waits between looks are skipped. */
const { findLostSend: actualFindLostSend } = jest.requireActual<
  typeof import("@app/self-custodial/payment-details/send-helpers")
>("@app/self-custodial/payment-details/send-helpers")

jest.mock("@app/utils/sleep", () => ({ sleep: () => Promise.resolve() }))
jest.mock("@app/utils/error-logging", () => ({ reportError: jest.fn() }))

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
  PaymentStatus: { Completed: 0, Pending: 1, Failed: 2 },
  // The shared fee-failure helper lives in send-helpers, which builds its tier→speed map
  // at module scope.
  OnchainConfirmationSpeed: { Fast: 0, Medium: 1, Slow: 2 },
  SuccessActionProcessed_Tags: { Aes: "Aes", Message: "Message", Url: "Url" },
  PaymentDetails: {
    Lightning: {
      instanceOf: (obj: { tag?: string } | undefined) => obj?.tag === "Lightning",
    },
    Spark: { instanceOf: (obj: { tag?: string } | undefined) => obj?.tag === "Spark" },
    Token: { instanceOf: (obj: { tag?: string } | undefined) => obj?.tag === "Token" },
  },
}))

/** The hash of the invoice a quote came back with: what the wallet's record of paying it
 *  carries, and what a send that threw after dispatch is looked up by. */
const QUOTED_HASH = "a".repeat(64)

/** What prepareLnurl answers: a fee, and the invoice the send would pay. */
const quote = (paymentHash = QUOTED_HASH) => ({
  feeSats: BigInt(0),
  invoiceDetails: { paymentHash },
})

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

  it("uses the LN address identifier as the display destination when present", () => {
    const detail = createSelfCustodialLnurlPaymentDetails(createParams())
    expect(detail.destination).toBe("user@example.com")
  })

  it("falls back to the bech32 lnurl when no identifier is present (raw LNURL pay)", () => {
    const detail = createSelfCustodialLnurlPaymentDetails(
      createParams({
        lnurlParams: baseLnurlParams({ identifier: "" }),
      }),
    )
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

  /** The shared screen contract calls setInvoice after fetching a Bolt11; the SDK fetches
   *  its own inside prepare, so the detail comes back unchanged rather than swapped. */
  it("keeps the same lnurl detail through setInvoice", () => {
    const detail = createSelfCustodialLnurlPaymentDetails(createParams())
    if (detail.paymentType !== PaymentType.Lnurl) throw new Error("expected lnurl")

    const afterInvoice = detail.setInvoice({
      paymentRequest: "lnbc1500n1fetched",
      paymentRequestAmount: {
        amount: 1500,
        currency: WalletCurrency.Btc,
        currencyCode: WalletCurrency.Btc,
      },
    })

    expect(afterInvoice.paymentType).toBe(PaymentType.Lnurl)
    expect(afterInvoice.destination).toBe(detail.destination)
    expect(afterInvoice.sendingWalletDescriptor).toEqual(detail.sendingWalletDescriptor)
  })

  it("carries a success action set after the fact", () => {
    const detail = createSelfCustodialLnurlPaymentDetails(createParams())
    if (detail.paymentType !== PaymentType.Lnurl) throw new Error("expected lnurl")
    const successAction = {
      tag: "message",
      message: "Thanks!",
      description: null,
      url: null,
      ciphertext: null,
      iv: null,
      decipher: () => null,
    } as const

    const withAction = detail.setSuccessAction(successAction)

    if (withAction.paymentType !== PaymentType.Lnurl) throw new Error("expected lnurl")
    expect(withAction.successAction).toBe(successAction)
  })

  it("recomputes the settlement amount with a replaced converter", () => {
    const detail = createSelfCustodialLnurlPaymentDetails(createParams())
    const doubled: typeof convertMoneyAmount = jest.fn((amount, target) => ({
      amount: amount.amount * 2,
      currency: target,
      currencyCode: target,
    }))

    const reconverted = detail.setConvertMoneyAmount(doubled)

    expect(reconverted.settlementAmount).toEqual(
      expect.objectContaining({ amount: 3000, currency: WalletCurrency.Btc }),
    )
  })

  describe("amount handling", () => {
    it("can neither quote nor send while the amount is zero", () => {
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({
          unitOfAccountAmount: {
            amount: 0,
            currency: WalletCurrency.Btc,
            currencyCode: WalletCurrency.Btc,
          },
        }),
      )

      expect(detail.canSendPayment).toBe(false)
      expect(detail.canGetFee).toBe(false)
    })

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

    it("setMemo overrides a destination-specified memo", () => {
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({ destinationSpecifiedMemo: "Payment to user@example.com" }),
      )
      if (!detail.canSetMemo) throw new Error("expected canSetMemo")

      expect(detail.setMemo("dinner").memo).toBe("dinner")
    })

    it("keeps the typed memo across successive edits", () => {
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({ destinationSpecifiedMemo: "Payment to user@example.com" }),
      )
      if (!detail.canSetMemo) throw new Error("expected canSetMemo")
      const once = detail.setMemo("din")
      if (!once.canSetMemo) throw new Error("expected canSetMemo")

      expect(once.setMemo("dinner").memo).toBe("dinner")
    })

    it("clearing the memo does not fall back to the destination memo", () => {
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({ destinationSpecifiedMemo: "Payment to user@example.com" }),
      )
      if (!detail.canSetMemo) throw new Error("expected canSetMemo")

      expect(detail.setMemo("").memo).toBe("")
    })

    it("sends the typed memo as the comment instead of the destination description", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({
          lnurlParams: baseLnurlParams({ commentAllowed: 200 }),
          destinationSpecifiedMemo: "Payment to user@example.com",
        }),
      )
      if (!detail.canSetMemo) throw new Error("expected canSetMemo")
      const updated = detail.setMemo("dinner")
      if (!updated.canGetFee) throw new Error("expected canGetFee")

      await updated.getFee({} as never)

      expect(mockPrepareLnurl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ comment: "dinner" }),
      )
    })

    it("truncates the comment to the length the destination allows", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({ lnurlParams: baseLnurlParams({ commentAllowed: 10 }) }),
      )
      if (!detail.canSetMemo) throw new Error("expected canSetMemo")
      const updated = detail.setMemo("a note far longer than the destination accepts")
      if (!updated.canGetFee) throw new Error("expected canGetFee")

      await updated.getFee({} as never)

      expect(mockPrepareLnurl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ comment: "a note far" }),
      )
    })
  })

  describe("prepareLnurl options (currency-aware shape)", () => {
    /** The SDK's pay request wants a string for the domain; the lnurl-pay library leaves it
     *  unset when the response named none. */
    it("hands the SDK an empty domain when the lnurl params carry none", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({ lnurlParams: baseLnurlParams({ domain: undefined }) }),
      )
      if (!detail.canGetFee) throw new Error("expected canGetFee")

      await detail.getFee({} as never)

      expect(mockPrepareLnurl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ payRequest: expect.objectContaining({ domain: "" }) }),
      )
    })

    it("USD wallet: passes USDB base units + tokenIdentifier + ToBitcoin + FeesIncluded", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
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
      mockPrepareLnurl.mockResolvedValue(quote())
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
      mockPrepareLnurl.mockResolvedValue(quote())
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
      mockPrepareLnurl.mockResolvedValue(quote())
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

    it("omits the comment when commentAllowed > 0 but memo is empty", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
      const detail = createSelfCustodialLnurlPaymentDetails(
        createParams({
          lnurlParams: baseLnurlParams({ commentAllowed: 200 }),
          senderSpecifiedMemo: "",
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
      mockPrepareLnurl.mockResolvedValue(quote())
      mockExtractLnurlFee.mockReturnValue(5)
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      const result = await detail.getFee({} as never)
      expect(result.amount?.amount).toBe(5)
      expect(result.amount?.currency).toBe(WalletCurrency.Btc)
    })

    it("returns currency: Btc regardless of the sending wallet generic (USD wallet)", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
      mockExtractLnurlFee.mockReturnValue(50)
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
      const result = await detail.getFee({} as never)
      expect(result.amount?.currency).toBe(WalletCurrency.Btc)
      expect(result.amount?.amount).toBe(50)
    })

    it("returns undefined amount when prepareLnurl throws", async () => {
      mockPrepareLnurl.mockRejectedValue(new Error("boom"))
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      const result = await detail.getFee({} as never)
      expect(result.amount).toBeUndefined()
    })

    // Without the classified code the confirmation screen can only show its generic
    // "unable to calculate fee", which names no cause and leaves the slider disabled.
    it("carries the classified code in errors when prepareLnurl throws", async () => {
      mockPrepareLnurl.mockRejectedValue({ tag: "LnurlError", inner: ["bad callback"] })
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      const result = await detail.getFee({} as never)
      expect(result.errors).toEqual([
        {
          __typename: "GraphQLApplicationError",
          message: SelfCustodialErrorCode.InvalidInput,
        },
      ])
    })

    it("falls back to the Generic code for an unclassified throw", async () => {
      mockPrepareLnurl.mockRejectedValue(new Error("boom"))
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      const result = await detail.getFee({} as never)
      expect(result.errors?.[0]?.message).toBe(SelfCustodialErrorCode.Generic)
    })

    it("leaves errors unset on a successful quote", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
      mockExtractLnurlFee.mockReturnValue(5)
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canGetFee) throw new Error("expected canGetFee")
      const result = await detail.getFee({} as never)
      expect(result.errors).toBeUndefined()
    })
  })

  describe("sendPaymentMutation", () => {
    it("returns Success with successAction in extraInfo on success (Message)", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
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
      expect(result.extraInfo?.successAction?.decipher("any-preimage")).toBeNull()
    })

    it("converts a URL successAction to the lnurl-pay shape", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
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
      expect(result.extraInfo?.successAction?.decipher("any-preimage")).toBeNull()
    })

    it("carries the decrypted plaintext on `message` (not via decipher) for AES Decrypted", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
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
      mockPrepareLnurl.mockResolvedValue(quote())
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

    it("classifies NetworkError tag with the network-error code", async () => {
      mockPrepareLnurl.mockRejectedValue({ tag: "NetworkError", inner: ["timeout"] })
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const result = await detail.sendPaymentMutation({} as never)
      expect(result.status).toBe(PaymentSendResult.Failure)
      expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.NetworkError)
    })

    it("classifies a generic (untagged) error with the generic code", async () => {
      mockPrepareLnurl.mockRejectedValue(new Error("boom"))
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const result = await detail.sendPaymentMutation({} as never)
      expect(result.status).toBe(PaymentSendResult.Failure)
      expect(result.errors?.[0].message).toBe(SelfCustodialErrorCode.Generic)
    })

    it("propagates preimage from Lightning htlcDetails and createdAt from payment.timestamp on success", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
      mockExecuteLnurl.mockResolvedValue({
        payment: {
          id: "p1",
          timestamp: BigInt(1747691078),
          details: {
            tag: "Lightning",
            inner: { htlcDetails: { preimage: "deadbeef-preimage" } },
          },
        },
        successAction: undefined,
      })
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const result = await detail.sendPaymentMutation({} as never)
      expect(result.status).toBe(PaymentSendResult.Success)
      expect(result.extraInfo?.preimage).toBe("deadbeef-preimage")
      expect(result.transaction?.createdAt).toBe(1747691078)
    })

    it("returns undefined preimage when payment.details is non-Lightning", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
      mockExecuteLnurl.mockResolvedValue({
        payment: {
          id: "p1",
          timestamp: BigInt(1747691078),
          details: { tag: "Spark", inner: {} },
        },
        successAction: undefined,
      })
      const detail = createSelfCustodialLnurlPaymentDetails(createParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const result = await detail.sendPaymentMutation({} as never)
      expect(result.extraInfo?.preimage).toBeUndefined()
      expect(result.transaction?.createdAt).toBe(1747691078)
    })
  })

  describe("metadataStr preservation (LUD-06 description hash)", () => {
    it("uses the raw metadata string from lnurlParams.rawData when available", async () => {
      mockPrepareLnurl.mockResolvedValue(quote())
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
      mockPrepareLnurl.mockResolvedValue(quote())
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
      mockPrepareLnurl.mockResolvedValue(quote())
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

describe("createSelfCustodialLnurlPaymentDetails idempotency key", () => {
  const btcWallet = { id: "w1", currency: WalletCurrency.Btc }
  const usdWallet = { id: "w-usd", currency: WalletCurrency.Usd }
  const btcAmount = {
    amount: 1500,
    currency: WalletCurrency.Btc,
    currencyCode: WalletCurrency.Btc,
  }
  const usdAmount = { amount: 100, currency: WalletCurrency.Usd, currencyCode: "USD" }

  /** The send hook mints the key into the detail's holder before every attempt, inside
   *  its own try, and reads it back on a retry; here that hand-off is played by hand. */
  const mint = <D extends { idempotencyKeyRef?: { current?: string } }>(
    detail: D,
    key = "uuid-1",
  ): D => {
    if (!detail.idempotencyKeyRef) throw new Error("expected idempotencyKeyRef")
    detail.idempotencyKeyRef.current = key
    return detail
  }

  /** Sends and answers with the key the SDK was handed, whatever wallet the detail is for. */
  const send = async (detail: {
    canSendPayment: boolean
    sendPaymentMutation?: (params: never) => Promise<unknown>
  }) => {
    if (!detail.canSendPayment || !detail.sendPaymentMutation) {
      throw new Error("expected canSendPayment")
    }
    await detail.sendPaymentMutation({} as never)
    return mockExecuteLnurl.mock.calls[mockExecuteLnurl.mock.calls.length - 1][2]
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrepareLnurl.mockResolvedValue(quote())
    mockExecuteLnurl.mockResolvedValue({
      payment: { id: "p1" },
      successAction: undefined,
    })
  })

  it("exposes an empty holder for the send hook to mint into", () => {
    const detail = createSelfCustodialLnurlPaymentDetails(createParams())

    expect(detail.idempotencyKeyRef).toEqual({})
  })

  it("keeps a holder it was handed", () => {
    const idempotencyKeyRef = { current: "uuid-handed" }

    const detail = createSelfCustodialLnurlPaymentDetails(
      createParams({ idempotencyKeyRef }),
    )

    expect(detail.idempotencyKeyRef).toBe(idempotencyKeyRef)
  })

  it("sends with no key until the hook has minted one", async () => {
    const detail = createSelfCustodialLnurlPaymentDetails(createParams())

    expect(await send(detail)).toBeUndefined()
  })

  it("forwards the minted key on a bitcoin send", async () => {
    const detail = mint(createSelfCustodialLnurlPaymentDetails(createParams()))

    expect(await send(detail)).toBe("uuid-1")
  })

  /** The wallet decides, not the currency the amount was typed in: a dollar-display
   *  user paying from bitcoin types dollars and still gets the key. */
  it("forwards it on a bitcoin send whose amount was typed in dollars", async () => {
    const detail = mint(
      createSelfCustodialLnurlPaymentDetails(
        createParams({
          sendingWalletDescriptor: btcWallet,
          unitOfAccountAmount: usdAmount,
        }),
      ),
    )

    expect(await send(detail)).toBe("uuid-1")
  })

  /**
   * The SDK rejects a key on any payment with a token leg, and a dollar send converts
   * USDB on the way out, so with a key every dollar send failed as invalid input.
   */
  it("sends from the dollar wallet without a key, which the SDK refuses on a conversion", async () => {
    const detail = mint(
      createSelfCustodialLnurlPaymentDetails(
        createParams({
          sendingWalletDescriptor: usdWallet,
          unitOfAccountAmount: usdAmount,
        }),
      ),
    )

    expect(await send(detail)).toBeUndefined()
  })

  it("drops it on a dollar send whose amount was typed in bitcoin", async () => {
    const detail = mint(
      createSelfCustodialLnurlPaymentDetails(
        createParams({
          sendingWalletDescriptor: usdWallet,
          unitOfAccountAmount: btcAmount,
        }),
      ),
    )

    expect(await send(detail)).toBeUndefined()
  })

  it("reuses the same key across retries within the same paymentDetail", async () => {
    const detail = mint(createSelfCustodialLnurlPaymentDetails(createParams()))

    expect(await send(detail)).toBe("uuid-1")
    expect(await send(detail)).toBe("uuid-1")
  })

  /**
   * Every rebuild that keeps the payment shares the holder, so a key minted before the
   * user backed out of the confirmation screen, or before the converter refreshed, is
   * the key the retry goes out with; a rebuild that started a fresh holder would let
   * that retry pay twice.
   */
  it("preserves the key across every recreation that keeps the payment", async () => {
    const detail = mint(createSelfCustodialLnurlPaymentDetails(createParams()))
    if (!detail.canSetMemo) throw new Error("expected canSetMemo")
    if (detail.paymentType !== PaymentType.Lnurl) throw new Error("expected lnurl")

    const reMemoed = detail.setMemo("new memo")
    expect(reMemoed.idempotencyKeyRef).toBe(detail.idempotencyKeyRef)
    expect(await send(reMemoed)).toBe("uuid-1")

    const reConverted = reMemoed.setConvertMoneyAmount(convertMoneyAmount)
    expect(reConverted.idempotencyKeyRef).toBe(detail.idempotencyKeyRef)
    expect(await send(reConverted)).toBe("uuid-1")

    if (reConverted.paymentType !== PaymentType.Lnurl) throw new Error("expected lnurl")
    const reInvoiced = reConverted.setInvoice({
      paymentRequest: "lnbc1500n1fetched",
      paymentRequestAmount: btcAmount,
    })
    expect(reInvoiced.idempotencyKeyRef).toBe(detail.idempotencyKeyRef)
    expect(await send(reInvoiced)).toBe("uuid-1")

    if (reInvoiced.paymentType !== PaymentType.Lnurl) throw new Error("expected lnurl")
    const reActioned = reInvoiced.setSuccessAction(undefined)
    expect(reActioned.idempotencyKeyRef).toBe(detail.idempotencyKeyRef)
    expect(await send(reActioned)).toBe("uuid-1")
  })

  /**
   * A new amount or wallet is a new payment, as the custodial details treat it: the SDK
   * answers a reused key with the payment it already made, which would report the old
   * amount as sent.
   */
  it("drops the key on a new amount or wallet", async () => {
    const detail = mint(createSelfCustodialLnurlPaymentDetails(createParams()))
    if (!detail.canSetAmount) throw new Error("expected canSetAmount")

    const reAmounted = detail.setAmount({ ...btcAmount, amount: 2000 })
    expect(reAmounted.idempotencyKeyRef).not.toBe(detail.idempotencyKeyRef)
    expect(await send(reAmounted)).toBeUndefined()

    const reWalleted = detail.setSendingWalletDescriptor({
      id: "w-btc-2",
      currency: WalletCurrency.Btc,
    })
    expect(reWalleted.idempotencyKeyRef).not.toBe(detail.idempotencyKeyRef)
    expect(await send(reWalleted)).toBeUndefined()
  })

  /** The wallet decides whether the key goes out, on whichever holder the switched
   *  detail carries. The setter's generic is crossed at runtime the same way the details
   *  screen crosses it, with the wallet's own currency. */
  it("sends with a key once switched to bitcoin, and without one once switched back to dollars", async () => {
    const fromDollars = mint(
      createSelfCustodialLnurlPaymentDetails(
        createParams({
          sendingWalletDescriptor: usdWallet,
          unitOfAccountAmount: usdAmount,
        }),
      ),
    )
    expect(await send(fromDollars)).toBeUndefined()

    const switchedToBitcoin = mint(
      fromDollars.setSendingWalletDescriptor(btcWallet as never),
      "uuid-2",
    )
    expect(await send(switchedToBitcoin)).toBe("uuid-2")
    expect(await send(switchedToBitcoin)).toBe("uuid-2")

    const switchedBack = mint(
      switchedToBitcoin.setSendingWalletDescriptor(usdWallet as never),
      "uuid-3",
    )
    expect(await send(switchedBack)).toBeUndefined()
  })
})

describe("createSelfCustodialLnurlPaymentDetails dollar send that throws after dispatch", () => {
  const usdParams = () =>
    createParams({
      sendingWalletDescriptor: { id: "w-usd", currency: WalletCurrency.Usd },
      unitOfAccountAmount: {
        amount: 100,
        currency: WalletCurrency.Usd,
        currencyCode: "USD",
      },
    })

  const COMPLETED = 0
  const PENDING = 1
  const RETRY_HASH = "b".repeat(64)

  /** A payment as the wallet records a send that threw after dispatch: a bare Lightning
   *  payment of the invoice, carrying its hash and, once released, its preimage. No
   *  lnurlPayInfo, which the wallet writes only once a pay-request send finished. */
  const paymentOf = (paymentHash: string, status: number) => ({
    id: "found-1",
    status,
    timestamp: BigInt(1747691078),
    details: {
      tag: "Lightning",
      inner: {
        htlcDetails: { paymentHash, preimage: "found-preimage" },
        lnurlPayInfo: undefined,
      },
    },
  })

  /** The same payment as the wallet records it once the send finished normally: the
   *  address and the success action it processed travel on the Lightning details. */
  const finishedPaymentOf = (paymentHash: string, status: number) => ({
    ...paymentOf(paymentHash, status),
    details: {
      tag: "Lightning",
      inner: {
        htlcDetails: { paymentHash, preimage: "found-preimage" },
        lnurlPayInfo: {
          lnAddress: "user@example.com",
          domain: "example.com",
          processedSuccessAction: {
            tag: "Message",
            inner: { data: { message: "Thanks!" } },
          },
        },
      },
    },
  })

  /** The same invoice, settled as a Spark transfer because the payee was a Spark wallet. */
  const sparkPaymentOf = (paymentHash: string, status: number) => ({
    id: "found-spark",
    status,
    timestamp: BigInt(1747691078),
    details: {
      tag: "Spark",
      inner: { htlcDetails: { paymentHash, preimage: "spark-preimage" } },
    },
  })

  const found = (payment: unknown) => ({ status: "found", payment })
  const notFound = () => ({ status: "not-found" })
  const unreadable = (error: unknown) => ({ status: "unreadable", error })

  const sendFromDollars = async (params = usdParams()) => {
    const detail = createSelfCustodialLnurlPaymentDetails(params)
    if (!detail.canSendPayment) throw new Error("expected canSendPayment")
    return detail.sendPaymentMutation({} as never)
  }

  type Lookup = {
    sdk: unknown
    startedAtMs: number
    matches: (payment: unknown) => boolean
  }
  const lookupAt = (index: number) => mockFindLostSend.mock.calls[index][0] as Lookup
  const lastLookup = () => lookupAt(mockFindLostSend.mock.calls.length - 1)

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrepareLnurl.mockResolvedValue(quote())
    mockExecuteLnurl.mockRejectedValue({ tag: "NetworkError" })
    mockFindLostSend.mockResolvedValue(notFound())
  })

  /**
   * Without a key the SDK cannot refuse a duplicate, and its own guidance for a send
   * that throws after dispatch is to look for the payment before sending again. The
   * lookup starts at the attempt and is bound to the invoice this attempt paid.
   */
  it("looks the payment up from the moment of the attempt, by the hash of the invoice it paid", async () => {
    const before = Date.now()

    await sendFromDollars()

    const lookup = lastLookup()
    expect(lookup.startedAtMs).toBeGreaterThanOrEqual(before)
    expect(lookup.startedAtMs).toBeLessThanOrEqual(Date.now())
    expect(lookup.matches(paymentOf(QUOTED_HASH, COMPLETED))).toBe(true)
    expect(lookup.matches(finishedPaymentOf(QUOTED_HASH, COMPLETED))).toBe(true)
    expect(lookup.matches(paymentOf(RETRY_HASH, COMPLETED))).toBe(false)
  })

  /** The wallet records the address only once a send finished normally, and a payment
   *  to the same address made moments earlier is not this one, so neither is looked at. */
  it("neither needs the address the wallet did not record nor takes another payment to it", async () => {
    await sendFromDollars()

    const { matches } = lastLookup()
    expect(matches(paymentOf(QUOTED_HASH, PENDING))).toBe(true)
    expect(matches(finishedPaymentOf(RETRY_HASH, COMPLETED))).toBe(false)
  })

  it("recognises the invoice whichever rail the wallet settled it over", async () => {
    await sendFromDollars()

    const { matches } = lastLookup()
    expect(matches(sparkPaymentOf(QUOTED_HASH, COMPLETED))).toBe(true)
    expect(matches(sparkPaymentOf(RETRY_HASH, COMPLETED))).toBe(false)
    expect(matches({ id: "x", details: { tag: "Spark", inner: {} } })).toBe(false)
    expect(matches({ id: "x", details: { tag: "Token", inner: {} } })).toBe(false)
    expect(matches({ id: "x", details: undefined })).toBe(false)
  })

  it("matches a raw lnurl's payment the same way, with no address or domain to go by", async () => {
    await sendFromDollars(
      createParams({
        sendingWalletDescriptor: { id: "w-usd", currency: WalletCurrency.Usd },
        unitOfAccountAmount: {
          amount: 100,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        },
        lnurlParams: baseLnurlParams({ identifier: "", domain: undefined }),
      }),
    )

    expect(lastLookup().matches(paymentOf(QUOTED_HASH, COMPLETED))).toBe(true)
  })

  it("reports the payment as sent when the wallet shows it completed", async () => {
    mockFindLostSend.mockResolvedValue(found(finishedPaymentOf(QUOTED_HASH, COMPLETED)))

    const result = await sendFromDollars()

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(result.transaction?.createdAt).toBe(1747691078)
    expect(result.extraInfo?.preimage).toBe("found-preimage")
    expect(result.extraInfo?.successAction?.tag).toBe("message")
    expect(result.extraInfo?.successAction?.message).toBe("Thanks!")
    expect(result.errors).toBeUndefined()
  })

  it("reports it as pending when the wallet shows it still in flight", async () => {
    mockFindLostSend.mockResolvedValue(found(paymentOf(QUOTED_HASH, PENDING)))

    const result = await sendFromDollars()

    expect(result.status).toBe(PaymentSendResult.Pending)
    expect(result.transaction?.createdAt).toBe(1747691078)
    expect(result.extraInfo?.preimage).toBe("found-preimage")
    expect(result.extraInfo?.successAction).toBeUndefined()
  })

  it("carries the preimage of a payment the wallet settled over Spark", async () => {
    mockFindLostSend.mockResolvedValue(found(sparkPaymentOf(QUOTED_HASH, COMPLETED)))

    const result = await sendFromDollars()

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(result.extraInfo?.preimage).toBe("spark-preimage")
    expect(result.extraInfo?.successAction).toBeUndefined()
  })

  it("carries no preimage or success action for a found payment without them", async () => {
    mockFindLostSend.mockResolvedValue(
      found({
        id: "found-2",
        status: COMPLETED,
        timestamp: BigInt(1747691078),
        details: { tag: "Spark", inner: {} },
      }),
    )

    const result = await sendFromDollars()

    expect(result.status).toBe(PaymentSendResult.Success)
    expect(result.extraInfo?.preimage).toBeUndefined()
    expect(result.extraInfo?.successAction).toBeUndefined()
  })

  /** Only a wallet that shows nothing makes the send safe to try again. */
  it("reports the failure only when the wallet shows nothing", async () => {
    const result = await sendFromDollars()

    expect(mockFindLostSend).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(PaymentSendResult.Failure)
    expect(result.errors?.[0]?.message).toBe(SelfCustodialErrorCode.NetworkError)
  })

  it("reports the failure, and keeps the attempt to look for, when the history could not be read", async () => {
    mockFindLostSend.mockResolvedValue(unreadable({ tag: "NetworkError" }))
    const detail = createSelfCustodialLnurlPaymentDetails(usdParams())
    if (!detail.canSendPayment) throw new Error("expected canSendPayment")

    const first = await detail.sendPaymentMutation({} as never)
    expect(first.status).toBe(PaymentSendResult.Failure)

    mockFindLostSend.mockResolvedValue(found(paymentOf(QUOTED_HASH, COMPLETED)))
    const retry = await detail.sendPaymentMutation({} as never)

    expect(retry.status).toBe(PaymentSendResult.Success)
    expect(mockExecuteLnurl).toHaveBeenCalledTimes(1)
  })

  describe("the retry after a lost attempt", () => {
    const FIRST_ATTEMPT_MS = 1_747_691_078_000
    const RETRY_MS = FIRST_ATTEMPT_MS + 30_000

    let nowSpy: jest.SpyInstance

    beforeEach(() => {
      nowSpy = jest.spyOn(Date, "now").mockReturnValue(FIRST_ATTEMPT_MS)
    })

    afterEach(() => {
      nowSpy.mockRestore()
    })

    const lostFirstAttempt = async () => {
      const detail = createSelfCustodialLnurlPaymentDetails(usdParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const first = await detail.sendPaymentMutation({} as never)
      expect(first.status).toBe(PaymentSendResult.Failure)
      nowSpy.mockReturnValue(RETRY_MS)
      /** The retry quotes afresh, so it pays a different invoice from the lost attempt. */
      mockPrepareLnurl.mockResolvedValue(quote(RETRY_HASH))
      return detail
    }

    /** The SDK's guidance is to look "before sending it again": the wallet may only have
     *  caught up with the payment once the connection is back, which is when the retry
     *  comes, so the retry looks for the earlier attempt's payment before it sends. */
    it("looks for the earlier attempt's invoice before sending, from that attempt's moment", async () => {
      const detail = await lostFirstAttempt()
      mockFindLostSend.mockResolvedValue(found(paymentOf(QUOTED_HASH, COMPLETED)))
      mockPrepareLnurl.mockClear()
      mockExecuteLnurl.mockClear()

      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const retry = await detail.sendPaymentMutation({} as never)

      expect(retry.status).toBe(PaymentSendResult.Success)
      expect(lastLookup().startedAtMs).toBe(FIRST_ATTEMPT_MS)
      expect(lastLookup().matches(paymentOf(QUOTED_HASH, PENDING))).toBe(true)
      expect(mockPrepareLnurl).not.toHaveBeenCalled()
      expect(mockExecuteLnurl).not.toHaveBeenCalled()
    })

    it("sends again when the earlier attempt still shows nothing, then looks for both invoices", async () => {
      const detail = await lostFirstAttempt()
      mockFindLostSend.mockClear()

      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const retry = await detail.sendPaymentMutation({} as never)

      expect(retry.status).toBe(PaymentSendResult.Failure)
      expect(mockExecuteLnurl).toHaveBeenCalledTimes(2)
      expect(mockFindLostSend).toHaveBeenCalledTimes(2)
      /** Before the retry sends: only the lost attempt's invoice can have been paid. */
      expect(lookupAt(0).startedAtMs).toBe(FIRST_ATTEMPT_MS)
      expect(lookupAt(0).matches(paymentOf(QUOTED_HASH, PENDING))).toBe(true)
      expect(lookupAt(0).matches(paymentOf(RETRY_HASH, PENDING))).toBe(false)
      /** After the retry threw too: either invoice may have landed. */
      expect(lookupAt(1).startedAtMs).toBe(FIRST_ATTEMPT_MS)
      expect(lookupAt(1).matches(paymentOf(QUOTED_HASH, PENDING))).toBe(true)
      expect(lookupAt(1).matches(paymentOf(RETRY_HASH, PENDING))).toBe(true)
    })

    /** A history that could not be read may hold the earlier payment, so nothing is sent
     *  over it: the retry fails as the connection problem it is, and the next one asks
     *  again. */
    it("sends nothing while the earlier attempt's history cannot be read", async () => {
      const detail = await lostFirstAttempt()
      mockFindLostSend.mockResolvedValue(unreadable({ tag: "NetworkError" }))
      mockPrepareLnurl.mockClear()
      mockExecuteLnurl.mockClear()

      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const retry = await detail.sendPaymentMutation({} as never)

      expect(retry.status).toBe(PaymentSendResult.Failure)
      expect(retry.errors?.[0]?.message).toBe(SelfCustodialErrorCode.NetworkError)
      expect(mockPrepareLnurl).not.toHaveBeenCalled()
      expect(mockExecuteLnurl).not.toHaveBeenCalled()

      mockFindLostSend.mockResolvedValue(found(paymentOf(QUOTED_HASH, COMPLETED)))
      const later = await detail.sendPaymentMutation({} as never)

      expect(later.status).toBe(PaymentSendResult.Success)
      expect(mockExecuteLnurl).not.toHaveBeenCalled()
    })

    it("stops looking once a send went through", async () => {
      const detail = await lostFirstAttempt()
      mockExecuteLnurl.mockResolvedValue({
        payment: { id: "p2" },
        successAction: undefined,
      })
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      await detail.sendPaymentMutation({} as never)
      mockFindLostSend.mockClear()

      mockExecuteLnurl.mockRejectedValue({ tag: "NetworkError" })
      await detail.sendPaymentMutation({} as never)

      expect(mockFindLostSend).toHaveBeenCalledTimes(1)
      expect(lastLookup().startedAtMs).toBe(RETRY_MS)
      expect(lastLookup().matches(paymentOf(QUOTED_HASH, PENDING))).toBe(false)
      expect(lastLookup().matches(paymentOf(RETRY_HASH, PENDING))).toBe(true)
    })

    it("stops looking once the earlier payment was found", async () => {
      const detail = await lostFirstAttempt()
      mockFindLostSend.mockResolvedValueOnce(found(paymentOf(QUOTED_HASH, COMPLETED)))
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      await detail.sendPaymentMutation({} as never)
      mockFindLostSend.mockClear()

      await detail.sendPaymentMutation({} as never)

      expect(mockFindLostSend).toHaveBeenCalledTimes(1)
      expect(lastLookup().startedAtMs).toBe(RETRY_MS)
      expect(lastLookup().matches(paymentOf(QUOTED_HASH, PENDING))).toBe(false)
    })

    /** The lost attempts ride the same holder as the key, and unlike the key they ride
     *  through every rebuild: the payment that may have gone out is as real after a new
     *  memo, a price tick, a new amount or a switch of wallet. */
    it("is carried by every rebuild, a new amount and wallet included", async () => {
      const detail = await lostFirstAttempt()
      if (!detail.canSetMemo) throw new Error("expected canSetMemo")
      if (!detail.canSetAmount) throw new Error("expected canSetAmount")

      const rebuilt = [
        detail.setMemo("new memo"),
        detail.setConvertMoneyAmount(convertMoneyAmount),
        detail.setAmount({
          amount: 200,
          currency: WalletCurrency.Usd,
          currencyCode: "USD",
        }),
        detail.setSendingWalletDescriptor({
          id: "w-btc",
          currency: WalletCurrency.Btc,
        } as never),
      ]
      for (const rebuild of rebuilt) {
        mockFindLostSend.mockClear()
        if (!rebuild.canSendPayment) throw new Error("expected canSendPayment")

        await rebuild.sendPaymentMutation({} as never)

        expect(lookupAt(0).startedAtMs).toBe(FIRST_ATTEMPT_MS)
        expect(lookupAt(0).matches(paymentOf(QUOTED_HASH, PENDING))).toBe(true)
      }
    })

    /** Once switched to the bitcoin wallet the new send carries a key, but the lost
     *  attempt did not: its payment is looked for before this one is dispatched. */
    it("still looks for the lost dollar attempt before a bitcoin send", async () => {
      const detail = await lostFirstAttempt()
      const switched = detail.setSendingWalletDescriptor({
        id: "w-btc",
        currency: WalletCurrency.Btc,
      } as never)
      if (!switched.idempotencyKeyRef) throw new Error("expected idempotencyKeyRef")
      switched.idempotencyKeyRef.current = "uuid-1"
      mockFindLostSend.mockResolvedValue(found(paymentOf(QUOTED_HASH, COMPLETED)))
      mockExecuteLnurl.mockClear()

      if (!switched.canSendPayment) throw new Error("expected canSendPayment")
      const result = await switched.sendPaymentMutation({} as never)

      expect(result.status).toBe(PaymentSendResult.Success)
      expect(mockExecuteLnurl).not.toHaveBeenCalled()
    })

    it("keeps the lost attempt when the retry's own quote fails", async () => {
      const detail = await lostFirstAttempt()
      mockPrepareLnurl.mockRejectedValueOnce({ tag: "NetworkError" })
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const failedQuote = await detail.sendPaymentMutation({} as never)
      expect(failedQuote.status).toBe(PaymentSendResult.Failure)
      mockFindLostSend.mockClear()

      await detail.sendPaymentMutation({} as never)

      expect(lookupAt(0).startedAtMs).toBe(FIRST_ATTEMPT_MS)
      expect(lookupAt(0).matches(paymentOf(QUOTED_HASH, PENDING))).toBe(true)
    })
  })

  /** Nothing has moved when the quote fails, so there is nothing to look for. */
  it("looks nothing up when the quote itself failed", async () => {
    mockPrepareLnurl.mockRejectedValue({ tag: "NetworkError" })

    const result = await sendFromDollars()

    expect(mockFindLostSend).not.toHaveBeenCalled()
    expect(mockExecuteLnurl).not.toHaveBeenCalled()
    expect(result.status).toBe(PaymentSendResult.Failure)
  })

  /** With a key the SDK refuses a retried duplicate itself, so the failure can be shown
   *  as one without asking the wallet first. */
  it("looks nothing up for a bitcoin send, whose retry the key guards", async () => {
    const detail = createSelfCustodialLnurlPaymentDetails(createParams())
    if (!detail.idempotencyKeyRef) throw new Error("expected idempotencyKeyRef")
    detail.idempotencyKeyRef.current = "uuid-1"
    if (!detail.canSendPayment) throw new Error("expected canSendPayment")

    const result = await detail.sendPaymentMutation({} as never)

    expect(mockFindLostSend).not.toHaveBeenCalled()
    expect(result.status).toBe(PaymentSendResult.Failure)
  })

  /** A new amount or wallet starts the key over, and with it goes the SDK's refusal of a
   *  duplicate. The attempt that threw is remembered all the same, so the send made after
   *  that looks for its payment first. */
  it("remembers a bitcoin attempt that threw, for the send made after a new amount", async () => {
    const detail = createSelfCustodialLnurlPaymentDetails(createParams())
    if (!detail.idempotencyKeyRef) throw new Error("expected idempotencyKeyRef")
    detail.idempotencyKeyRef.current = "uuid-1"
    if (!detail.canSendPayment) throw new Error("expected canSendPayment")
    if (!detail.canSetAmount) throw new Error("expected canSetAmount")
    await detail.sendPaymentMutation({} as never)
    mockFindLostSend.mockResolvedValue(found(paymentOf(QUOTED_HASH, COMPLETED)))
    mockExecuteLnurl.mockClear()

    const reAmounted = detail.setAmount({
      amount: 3000,
      currency: WalletCurrency.Btc,
      currencyCode: WalletCurrency.Btc,
    })
    if (!reAmounted.canSendPayment) throw new Error("expected canSendPayment")
    const result = await reAmounted.sendPaymentMutation({} as never)

    expect(mockFindLostSend).toHaveBeenCalledTimes(1)
    expect(lastLookup().matches(paymentOf(QUOTED_HASH, PENDING))).toBe(true)
    expect(result.status).toBe(PaymentSendResult.Success)
    expect(mockExecuteLnurl).not.toHaveBeenCalled()
  })

  /**
   * The real lookup against a history shaped the way the wallet writes a send that threw
   * after dispatch: a bare Lightning payment of the invoice, with no lnurlPayInfo. This is
   * the seam where a match by address could never find the payment it was for.
   */
  describe("against the wallet's own history", () => {
    const lostSendRecord = (paymentHash: string) => ({
      id: "transfer-1",
      status: PENDING,
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
      details: {
        tag: "Lightning",
        inner: {
          htlcDetails: { paymentHash, preimage: undefined },
          lnurlPayInfo: undefined,
        },
      },
    })

    const historyShows = (...payments: unknown[]) => {
      mockListSentPaymentsSince.mockResolvedValue({ payments })
    }

    beforeEach(() => {
      mockFindLostSend.mockImplementation(actualFindLostSend)
      mockSyncSelfCustodialWallet.mockResolvedValue(undefined)
      historyShows()
    })

    it("finds the dispatched payment as the wallet records it, instead of re-arming the slider", async () => {
      historyShows(lostSendRecord(QUOTED_HASH))

      const result = await sendFromDollars()

      expect(result.status).toBe(PaymentSendResult.Pending)
      expect(mockExecuteLnurl).toHaveBeenCalledTimes(1)
    })

    it("does not dispatch a second payment on the retry once the wallet shows the first", async () => {
      const detail = createSelfCustodialLnurlPaymentDetails(usdParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      const first = await detail.sendPaymentMutation({} as never)
      expect(first.status).toBe(PaymentSendResult.Failure)

      historyShows(lostSendRecord(QUOTED_HASH))
      mockExecuteLnurl.mockResolvedValue({
        payment: { id: "p2" },
        successAction: undefined,
      })
      const retry = await detail.sendPaymentMutation({} as never)

      expect(retry.status).toBe(PaymentSendResult.Pending)
      expect(mockExecuteLnurl).toHaveBeenCalledTimes(1)
    })

    it("finds the lost attempt by its own invoice although the retry quoted a new one", async () => {
      const detail = createSelfCustodialLnurlPaymentDetails(usdParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      await detail.sendPaymentMutation({} as never)

      mockPrepareLnurl.mockResolvedValue(quote(RETRY_HASH))
      historyShows(lostSendRecord(QUOTED_HASH))
      const retry = await detail.sendPaymentMutation({} as never)

      expect(retry.status).toBe(PaymentSendResult.Pending)
      expect(mockExecuteLnurl).toHaveBeenCalledTimes(1)
    })

    it("sends nothing on the retry while the wallet cannot catch up with the server", async () => {
      const detail = createSelfCustodialLnurlPaymentDetails(usdParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      await detail.sendPaymentMutation({} as never)

      mockSyncSelfCustodialWallet.mockRejectedValue({ tag: "NetworkError" })
      const retry = await detail.sendPaymentMutation({} as never)

      expect(retry.status).toBe(PaymentSendResult.Failure)
      expect(retry.errors?.[0]?.message).toBe(SelfCustodialErrorCode.NetworkError)
      expect(mockExecuteLnurl).toHaveBeenCalledTimes(1)
    })

    it("sends nothing on the retry while the history cannot be read", async () => {
      const detail = createSelfCustodialLnurlPaymentDetails(usdParams())
      if (!detail.canSendPayment) throw new Error("expected canSendPayment")
      await detail.sendPaymentMutation({} as never)

      mockListSentPaymentsSince.mockRejectedValue({ tag: "NetworkError" })
      const retry = await detail.sendPaymentMutation({} as never)

      expect(retry.status).toBe(PaymentSendResult.Failure)
      expect(retry.errors?.[0]?.message).toBe(SelfCustodialErrorCode.NetworkError)
      expect(mockExecuteLnurl).toHaveBeenCalledTimes(1)
    })
  })
})
