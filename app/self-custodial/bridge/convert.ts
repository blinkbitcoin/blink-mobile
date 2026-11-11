/* eslint-disable camelcase */
import {
  AmountAdjustmentReason,
  PaymentRequest,
  PrepareSendPaymentRequest,
  PrepareSendPaymentResponse,
  ReceivePaymentMethod,
  ReceivePaymentRequest,
  SendPaymentRequest,
  type BreezSdkInterface,
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
  findLostSend,
  isPaymentOfLostSend,
  readWalletClockSec,
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

/** A quoted conversion and the wallet's own invoice it pays, which is what the
 *  conversion can be found by in the wallet's history if its response is lost. */
type QuotedConversion = {
  prepared: PrepareSendPaymentResponse
  invoice: string
}

type PreparedConversion = QuotedConversion & {
  tokenDecimals: number
}

const prepareConversionWithDestination = async (
  sdk: BreezSdkInterface,
  {
    direction,
    destinationAmount,
  }: { direction: ConvertDirection; destinationAmount: bigint },
): Promise<QuotedConversion> => {
  const isBtcToUsd = direction === ConvertDirection.BtcToUsd
  const tokenIdentifier = isBtcToUsd ? requireSparkTokenIdentifier() : undefined
  const invoice = await createOwnSparkInvoice(sdk, destinationAmount, tokenIdentifier)
  const prepared = await sdk.prepareSendPayment(
    PrepareSendPaymentRequest.create({
      paymentRequest: new PaymentRequest.Input({ input: invoice }),
      amount: destinationAmount,
      tokenIdentifier,
      conversionOptions: buildConversionOptions(direction),
    }),
  )
  return { prepared, invoice }
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
  const discoveryEstimate = discovery.prepared.conversionEstimate
  if (!discoveryEstimate) return { ...discovery, tokenDecimals }

  const discoveryAmountIn = BigInt(toNumber(discoveryEstimate.amountIn))
  const discoveryAmountOut = BigInt(toNumber(discoveryEstimate.amountOut))
  if (discoveryAmountIn === 0n) return { ...discovery, tokenDecimals }

  const initialTarget = (discoveryAmountOut * inputAmount) / discoveryAmountIn
  if (initialTarget <= 0n) return { ...discovery, tokenDecimals }

  const final = await prepareConversionWithDestination(sdk, {
    direction: params.direction,
    destinationAmount: initialTarget,
  })

  const finalEstimate = final.prepared.conversionEstimate
  const finalAmountIn = BigInt(toNumber(finalEstimate?.amountIn ?? 0n))
  if (finalAmountIn <= inputAmount) return { ...final, tokenDecimals }

  /** SDK forced full-balance to avoid dust; correcting would swap the user's typed amount for the pool minimum. */
  if (finalEstimate?.amountAdjustment === AmountAdjustmentReason.IncreasedToAvoidDust) {
    return { ...final, tokenDecimals }
  }

  // Final overshoots: shrink by the observed ratio and re-quote once.
  const correctedTarget = (initialTarget * inputAmount) / finalAmountIn
  if (correctedTarget <= 0n) return { ...discovery, tokenDecimals }

  const corrected = await prepareConversionWithDestination(sdk, {
    direction: params.direction,
    destinationAmount: correctedTarget,
  })
  return { ...corrected, tokenDecimals }
}

const OUTCOME_UNKNOWN_MESSAGE = "Conversion outcome unknown"

/**
 * Sends a quoted conversion so that a retry can never convert twice.
 *
 * A conversion is a token leg, which the SDK takes no idempotency key on, and every quote
 * pays a fresh invoice, so a retry after a lost response would be a second conversion.
 * A conversion that throws after dispatch is looked for by its invoice; when it does not
 * turn up, the attempt ref keeps it, and every later conversion on that ref looks for it
 * again and is refused until it is found, telling the user to check their history.
 */
type ConversionExecution = QuotedConversion & {
  /** The measurement context the quote was made in: the quote closes over that
   *  context's SDK, so its outcome belongs to that context too. */
  startedIn: number
  params: ConvertParams
  attemptRef: ConvertAttemptRef
}

const executePrepared = async (
  sdk: BreezSdkInterface,
  { prepared, invoice, startedIn, params, attemptRef }: ConversionExecution,
): Promise<PaymentAdapterResult> => {
  /** Written through these rather than after each await: one conversion runs on a ref at
   *  a time (the screen's in-flight guard; auto-convert passes a ref of its own). */
  const keepUnresolved = (unresolved: UnresolvedConversion | undefined) => {
    attemptRef.unresolvedConversion = unresolved
  }

  const earlier = attemptRef.unresolvedConversion
  if (earlier) {
    /** The earlier conversion is looked for again first. Found, it is what this one
     *  reports, and nothing more is converted: the funds it moved are the ones this
     *  retry would move a second time. Still missing, it keeps every retry refused. */
    const lookup = await findLostSend({
      sdk,
      startedAtMs: earlier.startedAtMs,
      walletClockSec: earlier.walletClockSec,
      matches: (payment) =>
        isPaymentOfLostSend(
          { paymentHashes: [], sparkInvoices: [earlier.invoice] },
          payment,
        ),
    })
    if (lookup.status !== "found") {
      return failed(OUTCOME_UNKNOWN_MESSAGE, ConvertErrorCode.OutcomeUnknown)
    }
    keepUnresolved(undefined)
    return { status: PaymentResultStatus.Success }
  }
  const swapTelemetry = {
    direction: params.direction,
    source: params.source ?? "manual",
  }

  const startedAtMs = Date.now()
  try {
    const response = await sdk.sendPayment(
      SendPaymentRequest.create({ prepareResponse: prepared }),
    )
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

    const walletClockSec = await readWalletClockSec(sdk)
    const lost = await findLostSend({
      sdk,
      startedAtMs,
      walletClockSec,
      matches: (payment) =>
        isPaymentOfLostSend({ paymentHashes: [], sparkInvoices: [invoice] }, payment),
    })
    if (lost.status === "found") {
      measureIn(startedIn, ScEvent.SwapCompleted, swapTelemetry)
      return { status: PaymentResultStatus.Success }
    }

    reportSwapFailed()
    keepUnresolved({ invoice, startedAtMs, walletClockSec })
    return failed(OUTCOME_UNKNOWN_MESSAGE, ConvertErrorCode.OutcomeUnknown)
  }
}

const toConvertQuote = (
  sdk: BreezSdkInterface,
  {
    prepared,
    invoice,
    tokenDecimals,
    startedIn,
  }: PreparedConversion & { startedIn: number },
  params: ConvertParams,
): ConvertQuote | null => {
  const estimate = prepared.conversionEstimate
  if (!estimate) return null
  const feeCents = tokenBaseUnitsToCents(toNumber(estimate.fee), tokenDecimals)
  return {
    feeAmount: toUsdMoneyAmount(feeCents),
    amountAdjustment: mapAmountAdjustment(estimate.amountAdjustment),
    execute: (attemptRef = {}) =>
      executePrepared(sdk, { prepared, invoice, startedIn, params, attemptRef }),
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
