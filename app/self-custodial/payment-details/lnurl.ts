import {
  AesSuccessActionDataResult_Tags as AesResultTag,
  FeePolicy,
  SuccessActionProcessed_Tags as SuccessActionTag,
  type BreezSdkInterface,
  type LnurlPayRequestDetails,
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
import { ConvertDirection } from "@app/types/payment.types"

import {
  buildConversionType,
  executeLnurl,
  extractLnurlFee,
  prepareLnurl,
  resolveSendTokenIdentifier,
  toSdkSendAmount,
} from "../bridge"
import { classifySdkError } from "../sdk-error"

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
      message: null,
      description: decrypted.description,
      url: null,
      ciphertext: null,
      iv: null,
      decipher: () => decrypted.plaintext,
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

  const destinationSpecifiedAmount =
    lnurlParams.max === lnurlParams.min ? toBtcMoneyAmount(lnurlParams.max) : undefined

  const memo = destinationSpecifiedMemo || senderSpecifiedMemo
  const settlementAmount = convertMoneyAmount(
    unitOfAccountAmount,
    sendingWalletDescriptor.currency,
  )
  const isUsdSend = sendingWalletDescriptor.currency === WalletCurrency.Usd
  const payRequest = lnurlParamsToPayRequest(lnurlParams, lnurl)

  const prepareOptions = {
    amount: toSdkSendAmount(settlementAmount.amount, sendingWalletDescriptor.currency),
    payRequest,
    comment: lnurlParams.commentAllowed && memo ? memo : undefined,
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

  const sendPaymentAndGetFee: PaymentDetailSendPaymentGetFee<T> = settlementAmount.amount
    ? {
        canSendPayment: true,
        canGetFee: true,
        getFee: async () => {
          try {
            const prepared = await prepareLnurl(sdk, prepareOptions)
            const feeSats = extractLnurlFee(prepared)
            return { amount: asBtcSettlementAmount<T>(feeSats) }
          } catch {
            return { amount: undefined }
          }
        },
        sendPaymentMutation: async () => {
          try {
            const prepared = await prepareLnurl(sdk, prepareOptions)
            const result = await executeLnurl(sdk, prepared)
            return {
              status: PaymentSendResult.Success,
              extraInfo: {
                successAction: sdkSuccessActionToLib(result.successAction),
              },
            }
          } catch (err) {
            return {
              status: PaymentSendResult.Failure,
              errors: [
                {
                  __typename: "GraphQLApplicationError" as const,
                  message: classifySdkError(err),
                },
              ],
            }
          }
        },
      }
    : { canSendPayment: false, canGetFee: false }

  const setMemo: PaymentDetailSetMemo<T> = {
    canSetMemo: true,
    setMemo: (newMemo) =>
      createSelfCustodialLnurlPaymentDetails({
        ...params,
        senderSpecifiedMemo: newMemo,
      }),
  }

  const setAmount: SetAmount<T> = (newAmount) =>
    createSelfCustodialLnurlPaymentDetails({
      ...params,
      unitOfAccountAmount: newAmount,
    })

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (desc) =>
    createSelfCustodialLnurlPaymentDetails({
      ...params,
      sendingWalletDescriptor: desc,
    })

  const setConvertMoneyAmount = (fn: ConvertMoneyAmount) =>
    createSelfCustodialLnurlPaymentDetails({ ...params, convertMoneyAmount: fn })

  const setInvoice: SetInvoice<T> = () =>
    createSelfCustodialLnurlPaymentDetails({ ...params })

  const setSuccessAction: SetSuccessAction<T> = (newSuccessAction) =>
    createSelfCustodialLnurlPaymentDetails({
      ...params,
      successAction: newSuccessAction,
    })

  return {
    destination: lnurl,
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
