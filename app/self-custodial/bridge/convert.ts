import {
  AmountAdjustmentReason,
  PrepareSendPaymentRequest,
  PrepareSendPaymentResponse,
  ReceivePaymentMethod,
  ReceivePaymentRequest,
  SendPaymentRequest,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { centsToTokenBaseUnits } from "@app/types/amounts"
import {
  ConvertAmountAdjustment,
  ConvertDirection,
  ConvertErrorCode,
  PaymentResultStatus,
  type ConvertAdapter,
  type ConvertParams,
  type ConvertQuote,
  type GetConversionQuoteAdapter,
  type PaymentAdapterResult,
} from "@app/types/payment.types"
import { toNumber } from "@app/utils/helper"

import { SparkConfig } from "../config"

import { buildConversionType, fetchConversionLimits } from "./limits"
import { fetchUsdbDecimals } from "./token-balance"

const MIN_USD_FRACTION_DIGITS = 2

const formatUsdFromBaseUnits = (rawAmount: number, decimals: number): string => {
  const divisor = 10 ** decimals
  const whole = Math.floor(rawAmount / divisor)
  const fractional = rawAmount % divisor
  const padded = String(fractional).padStart(decimals, "0")
  const trimmed = padded.replace(/0+$/, "")
  const fractionalStr =
    trimmed.length < MIN_USD_FRACTION_DIGITS
      ? trimmed.padEnd(MIN_USD_FRACTION_DIGITS, "0")
      : trimmed
  return `$${whole}.${fractionalStr}`
}

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
  const destinationAmount = isBtcToUsd
    ? BigInt(centsToTokenBaseUnits(toAmount.amount, tokenDecimals))
    : BigInt(toAmount.amount)

  const paymentRequest = await createOwnSparkInvoice(
    sdk,
    destinationAmount,
    isBtcToUsd ? SparkConfig.tokenIdentifier : undefined,
  )

  const prepared = await sdk.prepareSendPayment(
    PrepareSendPaymentRequest.create({
      paymentRequest,
      amount: destinationAmount,
      tokenIdentifier: isBtcToUsd ? SparkConfig.tokenIdentifier : undefined,
      conversionOptions: buildConversionOptions(direction),
    }),
  )

  return { prepared, tokenDecimals }
}

const executePrepared = async (
  sdk: BreezSdkInterface,
  prepared: PrepareSendPaymentResponse,
): Promise<PaymentAdapterResult> => {
  try {
    await sdk.sendPayment(SendPaymentRequest.create({ prepareResponse: prepared }))
    return { status: PaymentResultStatus.Success }
  } catch (err) {
    return failed(err instanceof Error ? err.message : `Conversion failed: ${err}`)
  }
}

const toConvertQuote = (
  sdk: BreezSdkInterface,
  { prepared, tokenDecimals }: PreparedConversion,
): ConvertQuote | null => {
  const estimate = prepared.conversionEstimate
  if (!estimate) return null
  return {
    formattedFee: formatUsdFromBaseUnits(toNumber(estimate.fee), tokenDecimals),
    amountAdjustment: mapAmountAdjustment(estimate.amountAdjustment),
    execute: () => executePrepared(sdk, prepared),
  }
}

const toFailedResult = (err: unknown): PaymentAdapterResult => {
  if (err instanceof ConvertError) return failed(err.message, err.code)
  if (err instanceof Error) return failed(err.message)
  return failed(`Conversion failed: ${err}`)
}

export const createGetConversionQuote =
  (sdk: BreezSdkInterface): GetConversionQuoteAdapter =>
  async (params) => {
    try {
      const context = await prepareConversion(sdk, params)
      return toConvertQuote(sdk, context)
    } catch {
      return null
    }
  }

export const createConvert =
  (sdk: BreezSdkInterface): ConvertAdapter =>
  async (params) => {
    try {
      const context = await prepareConversion(sdk, params)
      return await executePrepared(sdk, context.prepared)
    } catch (err) {
      return toFailedResult(err)
    }
  }
