import {
  AesSuccessActionDataResult_Tags as AesResultTag,
  FeePolicy,
  PaymentDetails,
  PaymentStatus,
  SuccessActionProcessed_Tags as SuccessActionTag,
  type BreezSdkInterface,
  type LnurlPayRequestDetails,
  type Payment,
  type SuccessActionProcessed,
} from "@breeztech/breez-sdk-spark-react-native"
import { PaymentType } from "@blinkbitcoin/blink-client"
import { LnUrlPayServiceResponse, LNURLPaySuccessAction } from "lnurl-pay"

import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import {
  BaseCreatePaymentDetailsParams,
  ConvertMoneyAmount,
  IdempotencyKeyRef,
  PaymentDetail,
  PaymentDetailSendPaymentGetFee,
  PaymentDetailSetMemo,
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
import { classifySdkError } from "../sdk-error"

import { feeFailure, findLostSend } from "./send-helpers"

const SAT_TO_MILLISAT = BigInt(1000)

/**
 * When a keyless send last threw after dispatch without its payment turning up, held
 * the way the idempotency key is: on a holder every rebuild shares, so the retry the
 * user makes later, once the connection is back, looks for that payment first.
 */
type LostSendRef = { startedAtMs?: number }

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

const extractPreimage = (payment: Payment): string | undefined => {
  const details = payment.details
  if (!details || !PaymentDetails.Lightning.instanceOf(details)) return undefined
  return details.inner.htlcDetails.preimage
}

/** The success action the wallet kept with a payment, for one found after the fact. */
const extractProcessedSuccessAction = (
  payment: Payment,
): SuccessActionProcessed | undefined => {
  const details = payment.details
  if (!details || !PaymentDetails.Lightning.instanceOf(details)) return undefined
  return details.inner.lnurlPayInfo?.processedSuccessAction
}

/**
 * Whether a payment in the wallet's history went to this destination: by Lightning
 * address when the destination has one, by the LNURL's domain otherwise, both as the
 * wallet records them on a pay-request send.
 */
const isPaymentTo = (lnurlParams: LnUrlPayServiceResponse, payment: Payment): boolean => {
  const details = payment.details
  if (!details || !PaymentDetails.Lightning.instanceOf(details)) return false
  const info = details.inner.lnurlPayInfo
  if (!info) return false
  if (lnurlParams.identifier) return info.lnAddress === lnurlParams.identifier
  const hasDomain = Boolean(lnurlParams.domain)
  return hasDomain && info.domain === lnurlParams.domain
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
  idempotencyKeyRef?: IdempotencyKeyRef
  lostSendRef?: LostSendRef
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
   * rather than paid twice.
   */
  const idempotencyKeyRef = params.idempotencyKeyRef ?? {}
  const lostSendRef = params.lostSendRef ?? {}
  const paramsWithKey: CreateSCLnurlParams<T> = {
    ...params,
    idempotencyKeyRef,
    lostSendRef,
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

  /** The wallet's own record of a send this detail made, as the outcome to report. */
  const foundOutcome = (found: Payment) => {
    const status =
      found.status === PaymentStatus.Completed
        ? PaymentSendResult.Success
        : PaymentSendResult.Pending
    return sendOutcome(found, extractProcessedSuccessAction(found), status)
  }

  const findThisSend = (startedAtMs: number) =>
    findLostSend({
      sdk,
      startedAtMs,
      matches: (payment) => isPaymentTo(lnurlParams, payment),
    })

  const rememberLostAttempt = (startedAtMs: number) => {
    lostSendRef.startedAtMs = startedAtMs
  }
  const forgetLostAttempt = () => {
    lostSendRef.startedAtMs = undefined
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
         * it again". So a dollar send that throws after dispatch looks for its payment
         * before it is reported as failed, and a retry made later, once the connection
         * is back and the wallet has caught up, looks for the earlier attempt's payment
         * before it sends anything.
         */
        sendPaymentMutation: async () => {
          const isKeyedSend = !isUsdSend
          const sendIdempotencyKey = isKeyedSend ? idempotencyKeyRef.current : undefined

          const earlierAttemptMs = lostSendRef.startedAtMs
          if (!isKeyedSend && earlierAttemptMs !== undefined) {
            const earlier = await findThisSend(earlierAttemptMs)
            if (earlier) {
              forgetLostAttempt()
              return foundOutcome(earlier)
            }
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
          try {
            const result = await executeLnurl(sdk, prepared, sendIdempotencyKey)
            forgetLostAttempt()
            return sendOutcome(
              result.payment,
              result.successAction,
              PaymentSendResult.Success,
            )
          } catch (err) {
            if (isKeyedSend) return sendFailure(err)

            const lost = await findThisSend(startedAtMs)
            if (lost) {
              forgetLostAttempt()
              return foundOutcome(lost)
            }
            rememberLostAttempt(startedAtMs)
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
   * A new amount or wallet is a new payment, so both holders start over, as the custodial
   * details do: the SDK answers a reused key with the payment it already made, which
   * would report the old amount as sent, and an earlier attempt's payment is not this
   * one's to claim.
   */
  const setAmount: SetAmount<T> = (newAmount) =>
    createSelfCustodialLnurlPaymentDetails({
      ...paramsWithKey,
      idempotencyKeyRef: undefined,
      lostSendRef: undefined,
      unitOfAccountAmount: newAmount,
    })

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (desc) =>
    createSelfCustodialLnurlPaymentDetails({
      ...paramsWithKey,
      idempotencyKeyRef: undefined,
      lostSendRef: undefined,
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
    idempotencyKeyRef,
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
