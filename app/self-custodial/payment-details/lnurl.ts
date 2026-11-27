/* eslint-disable camelcase */
import {
  AesSuccessActionDataResult_Tags as AesResultTag,
  FeePolicy,
  PaymentDetails,
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
  PaymentDetail,
  PaymentDetailSendPaymentGetFee,
  PaymentDetailSetMemo,
  IdempotencyKeyRef,
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
  assertFeePolicyApplied,
  buildConversionType,
  executeLnurl,
  extractLnurlFee,
  prepareLnurl,
  resolveSendTokenIdentifier,
  toSdkSendAmount,
} from "../bridge"
import { isOwnLnurlAddress } from "../config"
import { ScEvent, ScRail } from "../measurement"
import { classifySdkError } from "../sdk-error"

import { htlcDetailsOf } from "./lost-send"
import {
  feeFailure,
  requestedAsOf,
  runSelfCustodialSend,
  sendAllFeePolicy,
  sendSettlement,
  settledOf,
} from "./send-helpers"

const SAT_TO_MILLISAT = BigInt(1000)

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
  /** Slid to 100%: the whole balance, with the fee taken out of it. */
  sendMax?: boolean
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
   * rather than paid twice. What a lost attempt leaves behind is kept by destination,
   * apart from the detail.
   */
  const idempotencyKeyRef: IdempotencyKeyRef = params.idempotencyKeyRef ?? {}
  const paramsWithKey: CreateSCLnurlParams<T> = {
    ...params,
    idempotencyKeyRef,
  }

  /**
   * The destination is shown by the identifier the pay-request names itself by, but that
   * is the server's word and two unrelated endpoints may give the same one. Lost attempts
   * are kept under what the sender scanned or typed, which is what was resolved to this
   * endpoint: never under a name another endpoint could share, which would report its
   * payment as this send's.
   */
  const destination = lnurlParams.identifier || lnurl
  const lostAttemptsKey = lnurl

  const destinationSpecifiedAmount =
    lnurlParams.max === lnurlParams.min ? toBtcMoneyAmount(lnurlParams.max) : undefined

  const memo = destinationSpecifiedMemo || senderSpecifiedMemo
  const settlementAmount = convertMoneyAmount(
    unitOfAccountAmount,
    sendingWalletDescriptor.currency,
  )
  const isUsdSend = sendingWalletDescriptor.currency === WalletCurrency.Usd
  // A pay request with its own amount can't be a send-all.
  const isSendingMax =
    !destinationSpecifiedAmount &&
    sendAllFeePolicy(params.sendMax, sendingWalletDescriptor.currency) !== undefined
  /** What a send-all asks of the SDK. A dollar send always takes its fee out too, but it
   *  keeps main's handling: its quote and receipt are not checked against the SDK's. */
  const sendAllPolicy = isSendingMax ? FeePolicy.FeesIncluded : undefined
  const payRequest = lnurlParamsToPayRequest(lnurlParams, lnurl)

  // Only the note the user typed travels as the comment. The destination's description
  // just prefills the note field, and the receiver shows the comment as the payer's note,
  // so sending it back would greet them with their own "Pay to" text.
  // `commentAllowed` is a maximum length, not a flag. The note field accepts more
  // characters than a destination typically allows, and an over-long comment would have
  // the pay request rejected outright.
  const comment =
    lnurlParams.commentAllowed && senderSpecifiedMemo
      ? senderSpecifiedMemo.slice(0, lnurlParams.commentAllowed)
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
    feePolicy: isUsdSend || isSendingMax ? FeePolicy.FeesIncluded : undefined,
  }

  /** LNURL sends report their own fine rail, split from plain BOLT11. */
  const sendTelemetry = {
    rail: ScRail.LnurlPay,
    sending_wallet: sendingWalletDescriptor.currency,
  }

  /** A payment to one of our own addresses is the inviter side of an Enhanced referral,
   *  reported with the settle and only if the payment settles; the join to the
   *  recipient's account creation is the server's, keyed on the address it serves. */
  const sendSettlementTelemetry = sendSettlement(
    sendTelemetry,
    isOwnLnurlAddress(destination)
      ? [
          {
            event: ScEvent.BlinkPaymentSent,
            params: { ...sendTelemetry, recipient_type: "blink_lightning_address" },
          },
        ]
      : [],
  )

  const sendFailure = (err: unknown) => ({
    status: PaymentSendResult.Failure,
    errors: [
      {
        __typename: "GraphQLApplicationError" as const,
        message: classifySdkError(err),
      },
    ],
  })

  /** The SDK's types promise a payment, but a response without one has been seen: the
   *  send is reported all the same, with nothing the payment would have added. */
  const sendOutcome = (
    payment: Payment | undefined,
    successAction: SuccessActionProcessed | undefined,
    status: PaymentSendResult,
  ) => {
    const transaction = payment && { createdAt: Number(payment.timestamp) }
    const preimage = payment && extractPreimage(payment)
    return {
      status,
      transaction,
      extraInfo: {
        preimage,
        successAction: sdkSuccessActionToLib(successAction),
        ...settledOf(sendAllPolicy, payment),
      },
    }
  }

  /** The wallet's own record of a send this detail made, reported as the send itself
   *  would have reported it: the SDK hands a payment back as soon as it is dispatched,
   *  pending or not, and every rail reports that as sent. */
  const foundOutcome = (found: Payment) =>
    sendOutcome(found, extractProcessedSuccessAction(found), PaymentSendResult.Success)

  const sendPaymentAndGetFee: PaymentDetailSendPaymentGetFee<T> = settlementAmount.amount
    ? {
        canSendPayment: true,
        canGetFee: true,
        getFee: async () => {
          try {
            const prepared = await prepareLnurl(sdk, prepareOptions)
            assertFeePolicyApplied(sendAllPolicy, prepared)
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
         * sent. A bitcoin send keeps the key, and a retry is refused as a duplicate. A
         * dollar send is looked for by the payment hash of each invoice its attempts
         * paid instead: every attempt pays a freshly quoted invoice.
         */
        sendPaymentMutation: () =>
          runSelfCustodialSend({
            sdk,
            idempotencyKeyRef,
            destination: lostAttemptsKey,
            telemetry: { params: sendTelemetry, settlement: sendSettlementTelemetry },
            prepare: async () => {
              const prepared = await prepareLnurl(sdk, prepareOptions)
              assertFeePolicyApplied(sendAllPolicy, prepared)
              return prepared
            },
            identify: (prepared) => ({
              paymentHash: prepared.invoiceDetails.paymentHash,
            }),
            execute: (prepared, idempotencyKey) =>
              executeLnurl(sdk, prepared, idempotencyKey),
            requestedAs: requestedAsOf(unitOfAccountAmount, settlementAmount),
            sentOutcome: (result) =>
              sendOutcome(
                result.payment,
                result.successAction,
                PaymentSendResult.Success,
              ),
            foundOutcome,
            failure: sendFailure,
          }),
      }
    : { canSendPayment: false, canGetFee: false }

  // Both memos are overwritten because the LNURL description supplied by the destination
  // otherwise keeps winning the `memo` resolution above, leaving the note field frozen on
  // the destination's own text. Mirrors the custodial LNURL
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
   * would report the old amount as sent. The lost attempts stay, kept by destination: a
   * payment that may have gone out does not stop being one because the amount changed,
   * and a send made without looking for it first could be the second one.
   */
  const setAmount: SetAmount<T> = (newAmount, newSendMax) =>
    createSelfCustodialLnurlPaymentDetails({
      ...paramsWithKey,
      idempotencyKeyRef: undefined,
      unitOfAccountAmount: newAmount,
      sendMax: newSendMax,
    })

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (desc) =>
    createSelfCustodialLnurlPaymentDetails({
      ...paramsWithKey,
      idempotencyKeyRef: undefined,
      sendingWalletDescriptor: desc,
      sendMax: false,
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
    destination,
    memo,
    comment,
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
    // A send-all takes the fee out of the amount (FeesIncluded).
    isFeeIncluded: isSendingMax,
    ...(destinationSpecifiedAmount
      ? { canSetAmount: false as const, destinationSpecifiedAmount }
      : {
          canSetAmount: true as const,
          setAmount,
          canSendMax: !isUsdSend,
          isSendingMax,
        }),
    ...setMemo,
    ...sendPaymentAndGetFee,
  } as PaymentDetail<T>
}
