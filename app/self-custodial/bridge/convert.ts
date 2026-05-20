import {
  AmountAdjustmentReason,
  PrepareSendPaymentRequest,
  PrepareSendPaymentResponse,
  ReceivePaymentMethod,
  ReceivePaymentRequest,
  SendPaymentRequest,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { toUsdMoneyAmount } from "@app/types/amounts"
import {
  ConvertAmountAdjustment,
  ConvertDirection,
  ConvertErrorCode,
  PaymentResultStatus,
  type ConvertParams,
  type ConvertQuote,
  type GetConversionQuoteAdapter,
  type PaymentAdapterResult,
} from "@app/types/payment.types"
import { centsToTokenBaseUnits, tokenBaseUnitsToCents } from "@app/utils/amounts"
import { toNumber } from "@app/utils/helper"

import { requireSparkTokenIdentifier, SparkConfig } from "../config"

import { buildConversionType, fetchConversionLimits } from "./limits"
import { fetchUsdbDecimals } from "./token-balance"

const failed = (message: string, code?: string): PaymentAdapterResult => ({
  status: PaymentResultStatus.Failed,
  errors: [{ message, code }],
})

class ConvertError extends Error {
  constructor(
    readonly code: ConvertErrorCode,
    message: string,
  ) {
    super(message)
  }
}

const mapAmountAdjustment = (
  reason: AmountAdjustmentReason | undefined,
): ConvertAmountAdjustment | undefined => {
  if (reason === AmountAdjustmentReason.FlooredToMinLimit) {
    return ConvertAmountAdjustment.FlooredToMin
  }
  if (reason === AmountAdjustmentReason.IncreasedToAvoidDust) {
    return ConvertAmountAdjustment.IncreasedToAvoidDust
  }
  return undefined
}

const createOwnSparkInvoice = async (
  sdk: BreezSdkInterface,
  amount: bigint,
  tokenIdentifier: string | undefined,
): Promise<string> => {
  const response = await sdk.receivePayment(
    ReceivePaymentRequest.create({
      paymentMethod: new ReceivePaymentMethod.SparkInvoice({
        amount,
        tokenIdentifier,
        expiryTime: undefined,
        description: undefined,
        senderPublicKey: undefined,
      }),
    }),
  )
  return response.paymentRequest
}

const buildConversionOptions = (direction: ConvertDirection) => ({
  conversionType: buildConversionType(direction),
  maxSlippageBps: SparkConfig.maxSlippageBps,
  completionTimeoutSecs: undefined,
})

type PreparedConversion = {
  prepared: PrepareSendPaymentResponse
  tokenDecimals: number
}

const recordConvertError = (err: unknown, params: ConvertParams, where: string): void => {
  crashlytics().log(
    `[Convert] ${where} failed (direction=${params.direction}, fromAmount=${params.fromAmount.amount}, toAmount=${params.toAmount.amount})`,
  )
  crashlytics().recordError(
    err instanceof Error ? err : new Error(`${where} failed: ${err}`),
  )
}

const prepareConversion = async (
  sdk: BreezSdkInterface,
  { fromAmount, toAmount, direction }: ConvertParams,
): Promise<PreparedConversion> => {
  const tokenDecimals = await fetchUsdbDecimals(sdk)
  const limits = await fetchConversionLimits(sdk, direction, tokenDecimals).catch(
    () => null,
  )
  if (!limits) {
    throw new ConvertError(
      ConvertErrorCode.LimitsUnavailable,
      "Conversion limits unavailable",
    )
  }
  if (limits.minFromAmount !== null && fromAmount.amount < limits.minFromAmount) {
    throw new ConvertError(
      ConvertErrorCode.BelowMinimum,
      "Amount is below the conversion minimum",
    )
  }
  if (limits.minToAmount !== null && toAmount.amount < limits.minToAmount) {
    throw new ConvertError(
      ConvertErrorCode.BelowMinimum,
      "Destination amount is below the conversion minimum",
    )
  }

  const isBtcToUsd = direction === ConvertDirection.BtcToUsd
  const tokenIdentifier = isBtcToUsd ? requireSparkTokenIdentifier() : undefined
  const destinationAmount = isBtcToUsd
    ? BigInt(centsToTokenBaseUnits(toAmount.amount, tokenDecimals))
    : BigInt(toAmount.amount)

  const paymentRequest = await createOwnSparkInvoice(
    sdk,
    destinationAmount,
    tokenIdentifier,
  )

  const prepared = await sdk.prepareSendPayment(
    PrepareSendPaymentRequest.create({
      paymentRequest,
      amount: destinationAmount,
      tokenIdentifier,
      conversionOptions: buildConversionOptions(direction),
    }),
  )

  return { prepared, tokenDecimals }
}

const executePrepared = async (
  sdk: BreezSdkInterface,
  prepared: PrepareSendPaymentResponse,
  params: ConvertParams,
): Promise<PaymentAdapterResult> => {
  try {
    await sdk.sendPayment(SendPaymentRequest.create({ prepareResponse: prepared }))
    return { status: PaymentResultStatus.Success }
  } catch (err) {
    recordConvertError(err, params, "executePrepared")
    return failed(err instanceof Error ? err.message : `Conversion failed: ${err}`)
  }
}

const toConvertQuote = (
  sdk: BreezSdkInterface,
  { prepared, tokenDecimals }: PreparedConversion,
  params: ConvertParams,
): ConvertQuote | null => {
  const estimate = prepared.conversionEstimate
  if (!estimate) return null
  const feeCents = tokenBaseUnitsToCents(toNumber(estimate.fee), tokenDecimals)
  return {
    feeAmount: toUsdMoneyAmount(feeCents),
    amountAdjustment: mapAmountAdjustment(estimate.amountAdjustment),
    execute: () => executePrepared(sdk, prepared, params),
  }
}

export const createGetConversionQuote =
  (sdk: BreezSdkInterface): GetConversionQuoteAdapter =>
  async (params) => {
    try {
      const context = await prepareConversion(sdk, params)
      return toConvertQuote(sdk, context, params)
    } catch (err) {
      recordConvertError(err, params, "getConversionQuote")
      throw err
    }
  }
