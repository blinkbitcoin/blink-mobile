/* eslint-disable camelcase */
import {
  AmountAdjustmentReason,
  PaymentDetails,
  PaymentRequest,
  PrepareSendPaymentRequest,
  PrepareSendPaymentResponse,
  ReceivePaymentMethod,
  ReceivePaymentRequest,
  SendPaymentRequest,
  type BreezSdkInterface,
  type ConversionEstimate,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { toUsdMoneyAmount } from "@app/types/amounts"
import { reportError } from "@app/utils/error-logging"
import { logBreadcrumb } from "@app/utils/error-reporting"
import {
  ConvertAmountAdjustment,
  ConvertDirection,
  ConvertErrorCode,
  PaymentResultStatus,
  type ConvertAttemptRef,
  type ConvertParams,
  type UnresolvedConversion,
  type ConvertQuote,
  type GetConversionQuoteAdapter,
  type PaymentAdapterResult,
} from "@app/types/payment"
import { centsToTokenBaseUnits, tokenBaseUnitsToCents } from "@app/utils/amounts"
import { toNumber } from "@app/utils/helper"

import { MAX_SLIPPAGE_BPS, requireSparkTokenIdentifier } from "../config"
import {
  measureIn,
  measurementGeneration,
  measureSettlement,
  ScEvent,
} from "../measurement"
import {
  CODES_RAISED_BEFORE_DISPATCH,
  findLostConversion,
  isAboutAmount,
  isAboutDelivered,
  isDeliveryAsExpected,
  markReceivedHistory,
  type ExpectedDelivery,
  type LostConversionLook,
} from "../payment-details/lost-send"
import { classifySdkError } from "../sdk-error"

import { buildConversionType, fetchConversionLimits } from "./limits"
import { fetchUsdbDecimals, findUsdbToken } from "./token-balance"

export const mapAmountAdjustment = (
  reason: AmountAdjustmentReason | undefined,
): ConvertAmountAdjustment | undefined => {
  if (reason === undefined) return undefined
  const map: Record<AmountAdjustmentReason, ConvertAmountAdjustment> = {
    [AmountAdjustmentReason.FlooredToMinLimit]: ConvertAmountAdjustment.FlooredToMin,
    [AmountAdjustmentReason.IncreasedToAvoidDust]:
      ConvertAmountAdjustment.IncreasedToAvoidDust,
  }
  return map[reason]
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

const recordConvertError = (err: unknown, params: ConvertParams, where: string): void => {
  logBreadcrumb(`[Convert] ${where} failed (direction=${params.direction})`)
  reportError(where, err)
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
  maxSlippageBps: MAX_SLIPPAGE_BPS,
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
      paymentRequest: new PaymentRequest.Input({ input: paymentRequest }),
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

const OUTCOME_UNKNOWN_MESSAGE = "Conversion outcome unknown"
const HISTORY_UNAVAILABLE_MESSAGE = "Wallet history unavailable"
const EARLIER_CONVERSION_MESSAGE = "Earlier conversion found"

/** Which way a conversion went, told by what it delivered: dollars for one from bitcoin,
 *  bitcoin for one to it. */
const directionDeliveredBy = (payment: Payment): ConvertDirection | undefined => {
  const { details } = payment
  if (!details) return undefined
  if (PaymentDetails.Token.instanceOf(details)) return ConvertDirection.BtcToUsd
  if (PaymentDetails.Spark.instanceOf(details)) return ConvertDirection.UsdToBtc
  return undefined
}

/**
 * Whether what a lost conversion delivered is this conversion asked again rather than
 * another: the same way, paying in about as much, or, before the wallet has filled in
 * what it paid in, delivering about as much as this one is quoted to.
 */
const isDeliveryOf = (
  payment: Payment,
  { estimate, params }: Pick<ConversionExecution, "estimate" | "params">,
): boolean => {
  if (directionDeliveredBy(payment) !== params.direction) return false
  const paidIn = payment.conversionDetails?.conversions?.[0]?.from.amount
  if (paidIn !== undefined) {
    return isAboutAmount(toNumber(paidIn), toNumber(estimate.amountIn))
  }
  return isAboutDelivered(toNumber(payment.amount), toNumber(estimate.amountOut))
}

/** The token a conversion delivers: the dollar token for one from bitcoin, none (sats)
 *  for one to it. */
const deliveredTokenOf = (direction: ConvertDirection): string | undefined =>
  direction === ConvertDirection.BtcToUsd ? requireSparkTokenIdentifier() : undefined

/**
 * How long after a lost conversion went out a look that does not find it is no proof it
 * never delivered: the pool's swap can outlast the SDK's own wait for it, and the look
 * after that. Until then the next conversion is refused; after it, the look's answer
 * stands.
 */
export const LOST_CONVERSION_DELIVERY_WINDOW_MS = 5 * 60 * 1000

/**
 * What is left of a lost conversion once one delivery of it is found: that payment known,
 * and the attempt it delivered for no longer looked for (the oldest, when the wallet does
 * not tell which). Nothing once no attempt is left: any other may still deliver, so
 * finding one never settles the rest.
 */
const withoutDeliveryOf = <L extends LostConversionLook>(
  lost: L,
  payment: Payment,
): L | undefined => {
  const matched = lost.expectedDeliveries.findIndex((delivery) =>
    isDeliveryAsExpected(payment, delivery),
  )
  const settled = Math.max(matched, 0)
  const expectedDeliveries = lost.expectedDeliveries.filter(
    (_, index) => index !== settled,
  )
  if (expectedDeliveries.length === 0) return undefined
  return {
    ...lost,
    expectedDeliveries,
    knownPaymentIds: [...lost.knownPaymentIds, payment.id],
  }
}

/**
 * Sends a quoted conversion so that a retry can never convert twice.
 *
 * A conversion is a token leg, which the SDK takes no idempotency key on, so a retry
 * after a lost response would be a second conversion. Nor can it be found by the invoice
 * it was quoted against: the SDK makes a conversion to the wallet itself inside the
 * wallet and never pays that invoice, and the payment the swap delivers is all it leaves
 * in the history. So where the wallet's received payments stand is marked before it goes
 * out, and one that throws after dispatch is looked for as an own conversion delivered
 * after that mark. When it does not turn up, the attempt ref keeps the mark, and the next
 * conversion on that ref looks for it first:
 * - found, it is reported, and nothing more is converted: as this conversion when it is
 *   the same one asked again, as an earlier one otherwise, for the user to check; any
 *   other attempt it holds is still looked for;
 * - read to its end without it, a few minutes after it went out, the lost conversion
 *   never delivered, and this one goes out, settling it once it does; sooner, it may
 *   still deliver, and this one is refused;
 * - unreadable, nothing is known, and this one is refused, telling the user to check
 *   their history.
 */
type ConversionExecution = {
  prepared: PrepareSendPaymentResponse
  /** What the quote pays in and is to deliver. */
  estimate: ConversionEstimate
  /** The measurement context the quote was made in: the quote closes over that
   *  context's SDK, so its outcome belongs to that context too. */
  startedIn: number
  params: ConvertParams
  attemptRef: ConvertAttemptRef
}

const executePrepared = async (
  sdk: BreezSdkInterface,
  { prepared, estimate, startedIn, params, attemptRef }: ConversionExecution,
): Promise<PaymentAdapterResult> => {
  /** Written through these rather than after each await: one conversion runs on a ref at
   *  a time (the screen's in-flight guard; auto-convert passes a ref of its own). */
  const keepUnresolved = (unresolved: UnresolvedConversion | undefined) => {
    attemptRef.unresolvedConversion = unresolved
  }
  const isThisConversion = (payment: Payment) =>
    isDeliveryOf(payment, { estimate, params })

  const earlier = attemptRef.unresolvedConversion
  if (earlier) {
    const lookup = await findLostConversion({ sdk, lost: earlier })
    if (lookup.status === "unreadable") {
      return failed(OUTCOME_UNKNOWN_MESSAGE, ConvertErrorCode.OutcomeUnknown)
    }
    if (lookup.status === "found") {
      keepUnresolved(withoutDeliveryOf(earlier, lookup.payment))
      if (isThisConversion(lookup.payment)) return { status: PaymentResultStatus.Success }
      return failed(EARLIER_CONVERSION_MESSAGE, ConvertErrorCode.EarlierConversionFound)
    }
    /** Not found so soon after it went out, it may still deliver. */
    const canStillDeliver =
      Date.now() - earlier.lastAttemptAtMs < LOST_CONVERSION_DELIVERY_WINDOW_MS
    if (canStillDeliver) {
      return failed(OUTCOME_UNKNOWN_MESSAGE, ConvertErrorCode.OutcomeUnknown)
    }
  }
  const swapTelemetry = {
    direction: params.direction,
    source: params.source ?? "manual",
  }

  /** Read before the conversion goes out, so what it delivers is told apart from every
   *  payment received before it. Unread, nothing is converted: a conversion lost without
   *  it could never be found again. */
  const mark = await markReceivedHistory(sdk).catch((err: unknown) => {
    recordConvertError(err, params, "markReceivedHistory")
    return undefined
  })
  if (!mark) {
    return failed(HISTORY_UNAVAILABLE_MESSAGE, ConvertErrorCode.HistoryUnavailable)
  }

  const startedAtMs = Date.now()
  try {
    const response = await sdk.sendPayment(
      SendPaymentRequest.create({ prepareResponse: prepared }),
    )
    /** Out, it settles the lost conversion it was let through past. */
    keepUnresolved(undefined)
    /** By the SDK's word on the payment, as for sends: a conversion normally comes back
     *  completed, and one that does not is held until its outcome is announced. */
    measureSettlement(
      response?.payment,
      {
        settled: [{ event: ScEvent.SwapCompleted, params: swapTelemetry }],
        failed: { event: ScEvent.SwapFailed, params: swapTelemetry },
      },
      startedIn,
    )
    return { status: PaymentResultStatus.Success }
  } catch (err) {
    recordConvertError(err, params, "executePrepared")
    const errorCode = classifySdkError(err)
    const reportSwapFailed = () =>
      measureIn(startedIn, ScEvent.SwapFailed, {
        ...swapTelemetry,
        error_code: errorCode,
      })

    if (CODES_RAISED_BEFORE_DISPATCH.has(errorCode)) {
      reportSwapFailed()
      return failed(err instanceof Error ? err.message : `Conversion failed: ${err}`)
    }

    /** Looked for together with the lost conversion it was let through past, from the
     *  earlier mark: either may have delivered by now. */
    const thisDelivery: ExpectedDelivery = {
      tokenIdentifier: deliveredTokenOf(params.direction),
      amount: toNumber(estimate.amountOut),
    }
    const lost: UnresolvedConversion = {
      ...(earlier ?? { startedAtMs, ...mark }),
      knownPaymentIds: [
        ...new Set([...(earlier?.knownPaymentIds ?? []), ...mark.knownPaymentIds]),
      ],
      expectedDeliveries: [...(earlier?.expectedDeliveries ?? []), thisDelivery],
      lastAttemptAtMs: startedAtMs,
    }
    const look = await findLostConversion({ sdk, lost })
    const isFoundAsThis = look.status === "found" && isThisConversion(look.payment)
    if (isFoundAsThis) {
      keepUnresolved(undefined)
      measureIn(startedIn, ScEvent.SwapCompleted, swapTelemetry)
      return { status: PaymentResultStatus.Success }
    }

    /** What an earlier conversion delivered leaves this one unaccounted for: it is not
     *  looked for again, and this one still is. */
    const knownPaymentIds =
      look.status === "found"
        ? [...lost.knownPaymentIds, look.payment.id]
        : lost.knownPaymentIds
    reportSwapFailed()
    keepUnresolved({ ...lost, knownPaymentIds })
    return failed(OUTCOME_UNKNOWN_MESSAGE, ConvertErrorCode.OutcomeUnknown)
  }
}

const toConvertQuote = (
  sdk: BreezSdkInterface,
  { prepared, tokenDecimals, startedIn }: PreparedConversion & { startedIn: number },
  params: ConvertParams,
): ConvertQuote | null => {
  const estimate = prepared.conversionEstimate
  if (!estimate) return null
  const feeCents = tokenBaseUnitsToCents(toNumber(estimate.fee), tokenDecimals)
  return {
    feeAmount: toUsdMoneyAmount(feeCents),
    amountAdjustment: mapAmountAdjustment(estimate.amountAdjustment),
    execute: (attemptRef = {}) =>
      executePrepared(sdk, { prepared, estimate, startedIn, params, attemptRef }),
  }
}

export const createGetConversionQuote =
  (sdk: BreezSdkInterface): GetConversionQuoteAdapter =>
  async (params) => {
    const startedIn = measurementGeneration()
    try {
      const context = await prepareConversion(sdk, params)
      return toConvertQuote(sdk, { ...context, startedIn }, params)
    } catch (err) {
      recordConvertError(err, params, "getConversionQuote")
      throw err
    }
  }
