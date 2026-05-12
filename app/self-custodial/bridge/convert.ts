import {
  AmountAdjustmentReason,
  PrepareSendPaymentRequest,
  PrepareSendPaymentResponse,
  ReceivePaymentMethod,
  ReceivePaymentRequest,
  SendPaymentRequest,
  SyncWalletRequest,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { toUsdMoneyAmount } from "@app/types/amounts"
import { reportError } from "@app/utils/error-logging"
import {
  ConvertAmountAdjustment,
  ConvertDirection,
  ConvertErrorCode,
  PaymentResultStatus,
  type ConvertParams,
  type ConvertQuote,
  type GetConversionQuoteAdapter,
  type PaymentAdapterResult,
} from "@app/types/payment"
import { centsToTokenBaseUnits, tokenBaseUnitsToCents } from "@app/utils/amounts"
import { toNumber } from "@app/utils/helper"

import { requireSparkTokenIdentifier, SparkConfig } from "../config"

import { buildConversionType, fetchConversionLimits } from "./limits"
import { fetchUsdbDecimals, findUsdbToken } from "./token-balance"

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

const recordConvertError = (err: unknown, params: ConvertParams, where: string): void => {
  crashlytics().log(
    `[Convert] ${where} failed (direction=${params.direction}, fromAmount=${params.fromAmount.amount}, toAmount=${params.toAmount.amount})`,
  )
  reportError(where, err)
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

const prepareConversionWithDestination = async (
  sdk: BreezSdkInterface,
  {
    direction,
    destinationAmount,
  }: { direction: ConvertDirection; destinationAmount: bigint },
): Promise<PrepareSendPaymentResponse> => {
  const isBtcToUsd = direction === ConvertDirection.BtcToUsd
  const tokenIdentifier = isBtcToUsd ? requireSparkTokenIdentifier() : undefined
  const paymentRequest = await createOwnSparkInvoice(
    sdk,
    destinationAmount,
    tokenIdentifier,
  )
  return sdk.prepareSendPayment(
    PrepareSendPaymentRequest.create({
      paymentRequest,
      amount: destinationAmount,
      tokenIdentifier,
      conversionOptions: buildConversionOptions(direction),
    }),
  )
}

const fetchLimitsOrThrow = async (
  sdk: BreezSdkInterface,
  direction: ConvertDirection,
  tokenDecimals: number,
): Promise<{ minFromAmount: number | null; minToAmount: number | null }> => {
  const limits = await fetchConversionLimits(sdk, direction, tokenDecimals).catch(
    () => null,
  )
  if (!limits) {
    throw new ConvertError(
      ConvertErrorCode.LimitsUnavailable,
      "Conversion limits unavailable",
    )
  }
  return limits
}

const enforceMinimums = (
  { fromAmount, toAmount }: ConvertParams,
  limits: { minFromAmount: number | null; minToAmount: number | null },
): void => {
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
}

const inputBaseUnits = (params: ConvertParams, tokenDecimals: number): bigint =>
  params.direction === ConvertDirection.BtcToUsd
    ? BigInt(params.fromAmount.amount)
    : BigInt(centsToTokenBaseUnits(params.fromAmount.amount, tokenDecimals))

const destinationBaseUnits = (
  params: ConvertParams,
  destAmount: number,
  tokenDecimals: number,
): bigint =>
  params.direction === ConvertDirection.BtcToUsd
    ? BigInt(centsToTokenBaseUnits(destAmount, tokenDecimals))
    : BigInt(destAmount)

const fetchFromBalanceBaseUnits = async (
  sdk: BreezSdkInterface,
  direction: ConvertDirection,
): Promise<bigint> => {
  const info = await sdk.getInfo({ ensureSynced: false })
  if (direction === ConvertDirection.BtcToUsd) {
    return info.balanceSats
  }
  const usdb = findUsdbToken(info)
  return usdb ? BigInt(toNumber(usdb.balance)) : 0n
}

/** Safety margin over `minFromAmount` for the discovery quote. */
const DISCOVERY_MIN_INPUT_MARGIN_BPS = 1000 // 10%

/**
 * Translates a pool minimum (input units) into destination units via the
 * UI rate, with a safety margin so the discovery quote stays above the
 * pool's input floor. Returns 0 when the pool min is unknown or the UI
 * lacks a rate to project against.
 */
const projectInputMinIntoDestination = (
  minFromAmount: number | null,
  uiInputAmount: number,
  uiDestinationAmount: number,
): number => {
  if (minFromAmount === null || uiInputAmount <= 0) return 0
  const uiRate = uiDestinationAmount / uiInputAmount
  const safetyMultiplier = 1 + DISCOVERY_MIN_INPUT_MARGIN_BPS / 10_000
  return Math.ceil(minFromAmount * uiRate * safetyMultiplier)
}

/**
 * Exact-input algorithm: discovery -> final -> optional correction.
 * Breez only accepts a destination amount and rejects `FeesIncluded`
 * on `FromBitcoin`, so we solve for the destination whose `amountIn`
 * lands on `inputAmount`.
 */
const prepareConversion = async (
  sdk: BreezSdkInterface,
  params: ConvertParams,
): Promise<PreparedConversion> => {
  const tokenDecimals = await fetchUsdbDecimals(sdk)
  const limits = await fetchLimitsOrThrow(sdk, params.direction, tokenDecimals)
  enforceMinimums(params, limits)

  // Cents round down to base units inflated above the real balance, so
  // cap against the SDK's authoritative value.
  const requestedInput = inputBaseUnits(params, tokenDecimals)
  const actualBalance = await fetchFromBalanceBaseUnits(sdk, params.direction)
  const inputAmount =
    actualBalance > 0n && actualBalance < requestedInput ? actualBalance : requestedInput

  const halfDestination = Math.max(1, Math.floor(params.toAmount.amount / 2))
  const fromMinInDestUnits = projectInputMinIntoDestination(
    limits.minFromAmount,
    params.fromAmount.amount,
    params.toAmount.amount,
  )
  const toMinInDestUnits = limits.minToAmount ?? 0
  const safeDiscoveryDestination = Math.max(
    halfDestination,
    fromMinInDestUnits,
    toMinInDestUnits,
  )
  const discoveryDestination = destinationBaseUnits(
    params,
    safeDiscoveryDestination,
    tokenDecimals,
  )

  const discovery = await prepareConversionWithDestination(sdk, {
    direction: params.direction,
    destinationAmount: discoveryDestination,
  })
  const discoveryEstimate = discovery.conversionEstimate
  if (!discoveryEstimate) return { prepared: discovery, tokenDecimals }

  const discoveryAmountIn = BigInt(toNumber(discoveryEstimate.amountIn))
  const discoveryAmountOut = BigInt(toNumber(discoveryEstimate.amountOut))
  if (discoveryAmountIn === 0n) return { prepared: discovery, tokenDecimals }

  const initialTarget = (discoveryAmountOut * inputAmount) / discoveryAmountIn
  if (initialTarget <= 0n) return { prepared: discovery, tokenDecimals }

  const prepared = await prepareConversionWithDestination(sdk, {
    direction: params.direction,
    destinationAmount: initialTarget,
  })

  const finalEstimate = prepared.conversionEstimate
  const finalAmountIn = BigInt(toNumber(finalEstimate?.amountIn ?? 0n))
  if (finalAmountIn <= inputAmount) return { prepared, tokenDecimals }

  /** SDK forced full-balance to avoid dust; correcting would swap the user's typed amount for the pool minimum. */
  if (finalEstimate?.amountAdjustment === AmountAdjustmentReason.IncreasedToAvoidDust) {
    return { prepared, tokenDecimals }
  }

  // Final overshoots: shrink by the observed ratio and re-quote once.
  const correctedTarget = (initialTarget * inputAmount) / finalAmountIn
  if (correctedTarget <= 0n) return { prepared: discovery, tokenDecimals }

  const corrected = await prepareConversionWithDestination(sdk, {
    direction: params.direction,
    destinationAmount: correctedTarget,
  })
  return { prepared: corrected, tokenDecimals }
}

const executePrepared = async (
  sdk: BreezSdkInterface,
  prepared: PrepareSendPaymentResponse,
  params: ConvertParams,
): Promise<PaymentAdapterResult> => {
  try {
    await sdk.sendPayment(SendPaymentRequest.create({ prepareResponse: prepared }))
    sdk.syncWallet(SyncWalletRequest.create({})).catch((err) => {
      reportError("convert: post-send syncWallet", err)
    })
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
