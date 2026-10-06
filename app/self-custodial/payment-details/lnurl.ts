import {
  AesSuccessActionDataResult_Tags as AesResultTag,
  FeePolicy,
  PaymentDetails,
  SuccessActionProcessed_Tags as SuccessActionTag,
  type BreezSdkInterface,
  type LnurlPayRequestDetails,
  type Payment,
  type SparkHtlcDetails,
  type SuccessActionProcessed,
} from "@breeztech/breez-sdk-spark-react-native"
import { PaymentType } from "@blinkbitcoin/blink-client"
import { LnUrlPayServiceResponse, LNURLPaySuccessAction } from "lnurl-pay"

import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import {
  BaseCreatePaymentDetailsParams,
  ConvertMoneyAmount,
  PaymentDetail,
  PaymentDetailSendPaymentGetFee,
  PaymentDetailSetMemo,
  SendAttemptRef,
  SetAmount,
  SetInvoice,
  SetSendingWalletDescriptor,
  SetSuccessAction,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import {
  toBtcMoneyAmount,
  type MoneyAmount,
  type WalletAmount,
  type WalletOrDisplayCurrency,
} from "@app/types/amounts"
import { ConvertDirection } from "@app/types/payment"

import {
  buildConversionType,
  executeLnurl,
  extractLnurlFee,
  prepareLnurl,
  resolveSendTokenIdentifier,
  toSdkSendAmount,
} from "../bridge"
import { classifySdkError, SelfCustodialErrorCode } from "../sdk-error"

import { feeFailure, findLostSend } from "./send-helpers"

const SAT_TO_MILLISAT = BigInt(1000)

/**
 * The failures the SDK raises before it sends anything: the amount, the request or the
 * funds were refused on the way in. Shown at once, since the looks that follow a throw
 * are for a payment that may have been dispatched, and none was.
 */
const CODES_RAISED_BEFORE_DISPATCH: ReadonlySet<SelfCustodialErrorCode> = new Set([
  SelfCustodialErrorCode.InsufficientFunds,
  SelfCustodialErrorCode.BelowMinimum,
  SelfCustodialErrorCode.InvalidInput,
])

const extractMetadataStr = (lnurlParams: LnUrlPayServiceResponse): string => {
  const raw = lnurlParams.rawData?.metadata
  if (typeof raw === "string") return raw
  return JSON.stringify(lnurlParams.metadata)
}

const lnurlParamsToPayRequest = (
  lnurlParams: LnUrlPayServiceResponse,
  lnurl: string,
): LnurlPayRequestDetails => ({
  callback: lnurlParams.callback,
  minSendable: BigInt(lnurlParams.min) * SAT_TO_MILLISAT,
  maxSendable: BigInt(lnurlParams.max) * SAT_TO_MILLISAT,
  metadataStr: extractMetadataStr(lnurlParams),
  commentAllowed: lnurlParams.commentAllowed,
  domain: lnurlParams.domain ?? "",
  url: lnurl,
  address: lnurlParams.identifier || undefined,
  allowsNostr: undefined,
  nostrPubkey: undefined,
})

/**
 * The HTLC a payment in the wallet's history settled, whichever rail carried it: a
 * Lightning payment's, or a Spark transfer's when the invoice was paid to a Spark wallet
 * directly. Both carry the invoice's payment hash and, once released, its preimage.
 */
const htlcDetailsOf = (payment: Payment): SparkHtlcDetails | undefined => {
  const details = payment.details
  if (!details) return undefined
  if (PaymentDetails.Lightning.instanceOf(details)) return details.inner.htlcDetails
  if (PaymentDetails.Spark.instanceOf(details)) return details.inner.htlcDetails
  return undefined
}

const extractPreimage = (payment: Payment): string | undefined =>
  htlcDetailsOf(payment)?.preimage

/** The success action the wallet kept with a payment, for one found after the fact. */
const extractProcessedSuccessAction = (
  payment: Payment,
): SuccessActionProcessed | undefined => {
  const details = payment.details
  if (!details || !PaymentDetails.Lightning.instanceOf(details)) return undefined
  return details.inner.lnurlPayInfo?.processedSuccessAction
}

/**
 * Whether a payment in the wallet's history is one of the invoices this detail's attempts
 * paid: by payment hash, the one thing the quoted invoice and the wallet's record of
 * paying it share, and that no other payment does.
 *
 * Not by the destination's address. The wallet records the address of a pay-request send
 * only once the send finished normally, and such a send never needs looking for; a send
 * that threw after dispatch reaches the history as a bare payment of the invoice. And
 * another payment to the same address, made moments earlier, is not this one.
 */
const isPaymentOf = (paymentHashes: ReadonlyArray<string>, payment: Payment): boolean => {
  const paymentHash = htlcDetailsOf(payment)?.paymentHash
  return paymentHash !== undefined && paymentHashes.includes(paymentHash)
}

const sdkSuccessActionToLib = (
  sa: SuccessActionProcessed | undefined,
): LNURLPaySuccessAction | undefined => {
  if (!sa) return undefined

  if (sa.tag === SuccessActionTag.Message) {
    return {
      tag: "message",
      message: sa.inner.data.message,
      description: null,
      url: null,
      ciphertext: null,
      iv: null,
      decipher: () => null,
    }
  }

  if (sa.tag === SuccessActionTag.Url) {
    return {
      tag: "url",
      message: null,
      description: sa.inner.data.description,
      url: sa.inner.data.url,
      ciphertext: null,
      iv: null,
      decipher: () => null,
    }
  }

  const result = sa.inner.result
  if (result.tag === AesResultTag.Decrypted) {
    const decrypted = result.inner.data
    return {
      tag: "aes",
      message: decrypted.plaintext,
      description: decrypted.description,
      url: null,
      ciphertext: null,
      iv: null,
      decipher: () => null,
    }
  }

  return {
    tag: "aes",
    message: null,
    description: result.inner.reason,
    url: null,
    ciphertext: null,
    iv: null,
    decipher: () => null,
  }
}

const asBtcSettlementAmount = <T extends WalletCurrency>(
  feeSats: number,
): WalletAmount<T> => toBtcMoneyAmount(feeSats) as unknown as WalletAmount<T>

type CreateSCLnurlParams<T extends WalletCurrency> = {
  sdk: BreezSdkInterface
  lnurl: string
  lnurlParams: LnUrlPayServiceResponse
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
  successAction?: LNURLPaySuccessAction
  isMerchant: boolean
  idempotencyKeyRef?: SendAttemptRef
} & BaseCreatePaymentDetailsParams<T>

export const createSelfCustodialLnurlPaymentDetails = <T extends WalletCurrency>(
  params: CreateSCLnurlParams<T>,
): PaymentDetail<T> => {
  const {
    sdk,
    lnurl,
    lnurlParams,
    unitOfAccountAmount,
    convertMoneyAmount,
    sendingWalletDescriptor,
    destinationSpecifiedMemo,
    senderSpecifiedMemo,
    successAction,
    isMerchant,
  } = params

  /**
   * Same holder for every rebuild, as the custodial details keep it: the send hook mints
   * the key into it on the first attempt, inside its own try, and reads it back on a
   * retry, so a bitcoin send retried after a throw is refused by the SDK as a duplicate
   * rather than paid twice. The lost attempts ride on it too.
   */
  const attemptRef: SendAttemptRef = params.idempotencyKeyRef ?? {}
  const paramsWithKey: CreateSCLnurlParams<T> = {
    ...params,
    idempotencyKeyRef: attemptRef,
  }

  const destinationSpecifiedAmount =
    lnurlParams.max === lnurlParams.min ? toBtcMoneyAmount(lnurlParams.max) : undefined

  const memo = destinationSpecifiedMemo || senderSpecifiedMemo
  const settlementAmount = convertMoneyAmount(
    unitOfAccountAmount,
    sendingWalletDescriptor.currency,
  )
  const isUsdSend = sendingWalletDescriptor.currency === WalletCurrency.Usd
  const payRequest = lnurlParamsToPayRequest(lnurlParams, lnurl)

  // `commentAllowed` is a maximum length, not a flag. The note field accepts more
  // characters than a destination typically allows, and since the note is now what fills
  // the comment an over-long one would have the pay request rejected outright.
  const comment =
    lnurlParams.commentAllowed && memo
      ? memo.slice(0, lnurlParams.commentAllowed)
      : undefined

  const prepareOptions = {
    amount: toSdkSendAmount(settlementAmount.amount, sendingWalletDescriptor.currency),
    payRequest,
    comment,
    tokenIdentifier: resolveSendTokenIdentifier(sendingWalletDescriptor.currency),
    conversionOptions: isUsdSend
      ? {
          conversionType: buildConversionType(ConvertDirection.UsdToBtc),
          maxSlippageBps: undefined,
          completionTimeoutSecs: undefined,
        }
      : undefined,
    feePolicy: isUsdSend ? FeePolicy.FeesIncluded : undefined,
  }

  const sendFailure = (err: unknown) => ({
    status: PaymentSendResult.Failure,
    errors: [
      {
        __typename: "GraphQLApplicationError" as const,
        message: classifySdkError(err),
      },
    ],
  })

  const sendOutcome = (
    payment: Payment,
    successAction: SuccessActionProcessed | undefined,
    status: PaymentSendResult,
  ) => ({
    status,
    transaction: { createdAt: Number(payment.timestamp) },
    extraInfo: {
      preimage: extractPreimage(payment),
      successAction: sdkSuccessActionToLib(successAction),
    },
  })

  /** The wallet's own record of a send this detail made, reported as the send itself
   *  would have reported it: the SDK hands a payment back as soon as it is dispatched,
   *  pending or not, and every rail reports that as sent. */
  const foundOutcome = (found: Payment) =>
    sendOutcome(found, extractProcessedSuccessAction(found), PaymentSendResult.Success)

  const findThisSend = (startedAtMs: number, paymentHashes: ReadonlyArray<string>) =>
    findLostSend({
      sdk,
      startedAtMs,
      matches: (payment) => isPaymentOf(paymentHashes, payment),
    })

  const rememberLostAttempts = (startedAtMs: number, paymentHashes: string[]) => {
    attemptRef.lostSend = { startedAtMs, paymentHashes }
  }
  const forgetLostAttempts = () => {
    attemptRef.lostSend = undefined
  }

  const sendPaymentAndGetFee: PaymentDetailSendPaymentGetFee<T> = settlementAmount.amount
    ? {
        canSendPayment: true,
        canGetFee: true,
        getFee: async () => {
          try {
            const prepared = await prepareLnurl(sdk, prepareOptions)
            const feeSats = extractLnurlFee(prepared)
            return { amount: asBtcSettlementAmount<T>(feeSats) }
          } catch (err) {
            return feeFailure<T>("Self-custodial LNURL fee", err)
          }
        },
        /**
         * The SDK refuses an idempotency key on any payment with a token leg. A dollar
         * send converts USDB on the way out, and that transfer has no idempotency hook,
         * so a key has the whole payment rejected as invalid input before anything is
         * sent. A bitcoin send keeps the key, and a retry is refused as a duplicate.
         *
         * Without a key the SDK's own warning applies: "retrying after a failure that
         * leaves the outcome unknown may pay twice … look for the payment before sending
         * it again". So a dollar send that throws after dispatch looks for the payment
         * of the invoice it was paying before it is reported as failed, and a retry made
         * later, once the connection is back, looks for the earlier attempts' payments
         * before it sends anything. Every attempt pays a freshly quoted invoice, so each
         * lost one is remembered by its own hash.
         */
        sendPaymentMutation: async () => {
          const isKeyedSend = !isUsdSend
          const sendIdempotencyKey = isKeyedSend ? attemptRef.current : undefined

          /** Looked for whatever this send is: the lost attempt's payment is as real
           *  after a switch of wallet or a new amount. */
          const earlierAttemptMs = attemptRef.lostSend?.startedAtMs
          const earlierHashes = attemptRef.lostSend?.paymentHashes ?? []
          const hasLostAttempt = earlierAttemptMs !== undefined
          if (hasLostAttempt) {
            const earlier = await findThisSend(earlierAttemptMs, earlierHashes)
            if (earlier.status === "found") {
              forgetLostAttempts()
              return foundOutcome(earlier.payment)
            }
            /** Nothing is sent over a history that could not be read: the payment it
             *  may hold would be paid again. The attempt stays remembered, and the next
             *  retry asks again. */
            if (earlier.status === "unreadable") return sendFailure(earlier.error)
          }

          /** Nothing has moved before the send itself, so a quote that fails is safe to
           *  report as a failure and try again. */
          let prepared
          try {
            prepared = await prepareLnurl(sdk, prepareOptions)
          } catch (err) {
            return sendFailure(err)
          }

          const startedAtMs = earlierAttemptMs ?? Date.now()
          const paymentHashes = [...earlierHashes, prepared.invoiceDetails.paymentHash]
          try {
            const result = await executeLnurl(sdk, prepared, sendIdempotencyKey)
            forgetLostAttempts()
            return sendOutcome(
              result.payment,
              result.successAction,
              PaymentSendResult.Success,
            )
          } catch (err) {
            /** Not looked for now when a retry under the same key is refused as a
             *  duplicate by the SDK anyway, nor when the SDK refused the send on the
             *  way in. Remembered all the same, in both cases: a new amount or wallet
             *  starts the key over, whether anything was dispatched is the SDK's word
             *  and not this code's, and the send made next has only the lookup between
             *  it and paying twice. */
            const isRaisedBeforeDispatch = CODES_RAISED_BEFORE_DISPATCH.has(
              classifySdkError(err),
            )
            const needsLookingFor = !isKeyedSend && !isRaisedBeforeDispatch
            if (needsLookingFor) {
              const lost = await findThisSend(startedAtMs, paymentHashes)
              if (lost.status === "found") {
                forgetLostAttempts()
                return foundOutcome(lost.payment)
              }
            }
            rememberLostAttempts(startedAtMs, paymentHashes)
            return sendFailure(err)
          }
        },
      }
    : { canSendPayment: false, canGetFee: false }

  // Both memos are overwritten because the LNURL description supplied by the destination
  // otherwise keeps winning the `memo` resolution above, leaving the note field frozen on
  // the destination's own text and sending it as the comment. Mirrors the custodial LNURL
  // details in app/screens/send-bitcoin-screen/payment-details/lightning.ts.
  // Consequence, also intentional and shared with custodial: once the user edits the note
  // the destination description is gone, so clearing the field sends no comment at all
  // rather than falling back to it.
  const setMemo: PaymentDetailSetMemo<T> = {
    canSetMemo: true,
    setMemo: (newMemo) =>
      createSelfCustodialLnurlPaymentDetails({
        ...paramsWithKey,
        senderSpecifiedMemo: newMemo,
        destinationSpecifiedMemo: newMemo,
      }),
  }

  /**
   * A new amount or wallet is a new payment, so the key starts over, as the custodial
   * details do: the SDK answers a reused key with the payment it already made, which
   * would report the old amount as sent. The lost attempts stay, as on every rebuild: a
   * payment that may have gone out does not stop being one because the amount changed,
   * and a send made without looking for it first could be the second one.
   */
  const setAmount: SetAmount<T> = (newAmount) =>
    createSelfCustodialLnurlPaymentDetails({
      ...paramsWithKey,
      idempotencyKeyRef: { lostSend: attemptRef.lostSend },
      unitOfAccountAmount: newAmount,
    })

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (desc) =>
    createSelfCustodialLnurlPaymentDetails({
      ...paramsWithKey,
      idempotencyKeyRef: { lostSend: attemptRef.lostSend },
      sendingWalletDescriptor: desc,
    })

  const setConvertMoneyAmount = (fn: ConvertMoneyAmount) =>
    createSelfCustodialLnurlPaymentDetails({ ...paramsWithKey, convertMoneyAmount: fn })

  const setInvoice: SetInvoice<T> = () =>
    createSelfCustodialLnurlPaymentDetails({ ...paramsWithKey })

  const setSuccessAction: SetSuccessAction<T> = (newSuccessAction) =>
    createSelfCustodialLnurlPaymentDetails({
      ...paramsWithKey,
      successAction: newSuccessAction,
    })

  return {
    destination: lnurlParams.identifier || lnurl,
    memo,
    convertMoneyAmount,
    setConvertMoneyAmount,
    paymentType: PaymentType.Lnurl,
    settlementAmount,
    settlementAmountIsEstimated: false,
    unitOfAccountAmount,
    sendingWalletDescriptor,
    setSendingWalletDescriptor,
    lnurlParams,
    setInvoice,
    idempotencyKeyRef: attemptRef,
    successAction,
    setSuccessAction,
    isMerchant,
    ...(destinationSpecifiedAmount
      ? { canSetAmount: false as const, destinationSpecifiedAmount }
      : { canSetAmount: true as const, setAmount }),
    ...setMemo,
    ...sendPaymentAndGetFee,
  } as PaymentDetail<T>
}
