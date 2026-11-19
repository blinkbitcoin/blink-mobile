/* eslint-disable camelcase */
import {
  AmountAdjustmentReason,
  PaymentDetails,
  PaymentRequest,
  PaymentStatus,
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
  type ConvertExecuteOptions,
  type ConvertParams,
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
  lostAttemptsFor,
  OWN_CONVERSIONS,
  type LostAttemptsHandle,
  type LostConversion,
} from "../payment-details/lost-attempts"
import {
  CODES_RAISED_BEFORE_DISPATCH,
  findLostConversion,
  isAboutAmount,
  isAboutDelivered,
  isDeliveryAsExpected,
  markReceivedHistory,
  paidInOf,
  type ExpectedDelivery,
  type LostConversionLook,
  type LostSendLookup,
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
const CONVERSION_FAILED_MESSAGE = "Conversion failed"
const ALREADY_CONVERTED_MESSAGE = "Already converted"

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
  const paidIn = paidInOf(payment)
  if (paidIn !== undefined) {
    return isAboutAmount(paidIn, toNumber(estimate.amountIn))
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
 * By this app launch's clock, which only moves forward with real time and which no change
 * of the phone's clock moves, when each lost conversion's latest attempt was first known:
 * when its outcome was lost, in this launch, or when this launch first read it back. Keyed
 * by that attempt's time.
 */
const firstKnownAt = new Map<number, number>()

/** Real time this launch has known a lost conversion's latest attempt for. */
const realMsKnown = (lastAttemptAtMs: number): number => {
  const now = performance.now()
  const knownAt = firstKnownAt.get(lastAttemptAtMs) ?? now
  firstKnownAt.set(lastAttemptAtMs, knownAt)
  return now - knownAt
}

/** Whether a time elapsed is within the delivery window: one that cannot be told, as a
 *  clock that answers no number, is taken as within it. */
const isWithinDeliveryWindow = (elapsedMs: number): boolean =>
  !(elapsedMs >= LOST_CONVERSION_DELIVERY_WINDOW_MS)

/**
 * Whether a lost conversion not found may still deliver: its delivery window has not run
 * out by real time. Never by the phone's clock, which a correction moves either way:
 * ahead, a conversion just sent would look long gone; back, conversions would stay refused
 * for as long as it was moved. Real time cannot be read across app launches, so a launch
 * counts it from when it first read the conversion back, never less than it really was.
 */
const canStillDeliver = (lastAttemptAtMs: number): boolean =>
  isWithinDeliveryWindow(realMsKnown(lastAttemptAtMs))

/** Whether a delivery found is what any of a lost conversion's attempts was quoted to
 *  deliver. */
const isDeliveryOfAnyAttempt = (lost: LostConversionLook, payment: Payment): boolean =>
  lost.expectedDeliveries.some((delivery) => isDeliveryAsExpected(payment, delivery))

/**
 * Which of a lost conversion's attempts a delivery found settles: the one it delivers for,
 * of the conversion's own kind first, and none when it delivers for none of them, since it
 * is then no proof that any of them delivered. Auto-convert tells no one what it finds, so
 * it settles only an attempt of its own, and none for a delivery of a transfer the user
 * made: that one is the user's to be told of, or their own retry would convert it again.
 */
const settledAttemptOf = (
  lost: LostConversionLook,
  payment: Payment,
  isAutomatic: boolean,
): number | undefined => {
  const matches = (delivery: ExpectedDelivery) => isDeliveryAsExpected(payment, delivery)
  const own = lost.expectedDeliveries.findIndex(
    (delivery) => delivery.isAutomatic === isAutomatic && matches(delivery),
  )
  if (own >= 0) return own
  if (isAutomatic) return undefined
  const other = lost.expectedDeliveries.findIndex(matches)
  return other >= 0 ? other : undefined
}

/**
 * What is left of a lost conversion once a delivery found settles one of its attempts:
 * that payment known, and that attempt no longer looked for. Nothing once no attempt is
 * left: any other may still deliver, so finding one never settles the rest.
 */
const withoutAttempt = <L extends LostConversionLook>(
  lost: L,
  settled: number,
  payment: Payment,
): L | undefined => {
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

/** What a look for a conversion lost as it went out leaves to look for, and whether what
 *  it found is surely this conversion's delivery. */
type SettledByLook = { left: LostConversion | undefined; isSurelyThis: boolean }

/**
 * What a look for this conversion, lost as it went out, settles: the attempt the delivery
 * it found is for, by the same rule as the look before a conversion (`settledAttemptOf`),
 * and only that one. The delivery is this conversion's only when that attempt is this
 * one, it is this conversion by what it paid in, and no attempt left could have delivered
 * it as well. A delivery the rule gives to no attempt, or gives to this one while what it
 * paid in says otherwise, settles nothing and stays unknown: the next look finds it again
 * and settles it then, telling the user, rather than hiding it here.
 */
const settledByLook = (
  look: LostSendLookup,
  lost: LostConversion,
  {
    isAutomatic,
    isThisConversion,
  }: { isAutomatic: boolean; isThisConversion: (payment: Payment) => boolean },
): SettledByLook => {
  const nothingSettled = { left: lost, isSurelyThis: false }
  if (look.status !== "found") return nothingSettled
  const { payment } = look
  const settled = settledAttemptOf(lost, payment, isAutomatic)
  if (settled === undefined) return nothingSettled
  const isThisAttempt = settled === lost.expectedDeliveries.length - 1
  const isPaidInOtherwise = isThisAttempt && !isThisConversion(payment)
  if (isPaidInOtherwise) return nothingSettled
  const left = withoutAttempt(lost, settled, payment)
  const canBeAnotherAttempts =
    left?.expectedDeliveries.some((delivery) =>
      isDeliveryAsExpected(payment, delivery),
    ) ?? false
  return { left, isSurelyThis: isThisAttempt && !canBeAnotherAttempts }
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
 * after that mark. The mark is stored with the wallet's lost attempts before the
 * conversion goes out, so an app closed with it in flight leaves it to be looked for too,
 * and is kept when it does not turn up, across app launches. The next conversion in the
 * wallet, manual or automatic, looks for it first:
 * - found, it is reported, and nothing more is converted: as this conversion when it is
 *   the same one asked again, as an earlier one otherwise, for the user to check; any
 *   other attempt it holds is still looked for;
 * - read to its end without it, a few minutes after it went out, the lost conversion
 *   never delivered, and this one goes out, settling it once it does; sooner, it may
 *   still deliver, and this one is refused;
 * - unreadable, nothing is known, and this one is refused, telling the user to check
 *   their history.
 *
 * One conversion runs at a time in a wallet, from that look to its own outcome: two at
 * once would each find nothing lost and both go out, a screen opened again while the
 * first is still being looked for included.
 */
type ConversionExecution = {
  prepared: PrepareSendPaymentResponse
  /** What the quote pays in and is to deliver. */
  estimate: ConversionEstimate
  /** The measurement context the quote was made in: the quote closes over that
   *  context's SDK, so its outcome belongs to that context too. */
  startedIn: number
  params: ConvertParams
} & ConvertExecuteOptions

/** What a conversion that went out paid in, and which way. */
type ConversionOut = { direction: ConvertDirection; amountIn: number }

/** By the wallet's SDK, what went out while each of its conversions waited for its turn. */
const waitingConversions = new WeakMap<BreezSdkInterface, Set<ConversionOut[]>>()

const waitingIn = (sdk: BreezSdkInterface): Set<ConversionOut[]> => {
  const held = waitingConversions.get(sdk) ?? new Set<ConversionOut[]>()
  waitingConversions.set(sdk, held)
  return held
}

const executePrepared = (
  sdk: BreezSdkInterface,
  execution: ConversionExecution,
): Promise<PaymentAdapterResult> => {
  /** Taken once: a conversion that finishes after a switch of wallet settles its own
   *  wallet's lost conversion, not the next one's. */
  const attempts = lostAttemptsFor(OWN_CONVERSIONS)
  const waiting = waitingIn(sdk)
  const wentOutMeanwhile: ConversionOut[] = []
  waiting.add(wentOutMeanwhile)
  return attempts.oneAtATime(async () => {
    waiting.delete(wentOutMeanwhile)
    const result = await convertAfterEarlierConversions(sdk, attempts, {
      ...execution,
      wentOutMeanwhile,
    })
    /** Each conversion still waiting for its turn is told what this one converted. */
    const isConverted = result.status === PaymentResultStatus.Success
    if (isConverted) {
      const out = {
        direction: execution.params.direction,
        amountIn: toNumber(execution.estimate.amountIn),
      }
      waiting.forEach((meanwhile) => meanwhile.push(out))
    }
    return result
  })
}

/** The conversion itself, alone among the wallet's conversions. */
const convertAfterEarlierConversions = async (
  sdk: BreezSdkInterface,
  attempts: LostAttemptsHandle,
  {
    prepared,
    estimate,
    startedIn,
    params,
    isConvertedMeanwhile,
    wentOutMeanwhile,
  }: ConversionExecution & { wentOutMeanwhile: readonly ConversionOut[] },
): Promise<PaymentAdapterResult> => {
  /** Nothing is converted while what an earlier launch lost has not been read back: a
   *  conversion it lost may be this one, done already. */
  await attempts.retryStorage()
  if (!attempts.isStoredRead()) {
    return failed(HISTORY_UNAVAILABLE_MESSAGE, ConvertErrorCode.HistoryUnavailable)
  }

  const isAutomatic = params.source === "auto_convert"
  const keepLost = (lostConversion: LostConversion | undefined) =>
    attempts.update((current) => ({ ...current, lostConversion }))
  const isThisConversion = (payment: Payment) =>
    isDeliveryOf(payment, { estimate, params })

  const earlier = attempts.read().lostConversion
  if (earlier) {
    const lookup = await findLostConversion({ sdk, lost: earlier })
    if (lookup.status === "unreadable") {
      return failed(OUTCOME_UNKNOWN_MESSAGE, ConvertErrorCode.OutcomeUnknown)
    }
    if (lookup.status === "found") {
      const settled = settledAttemptOf(earlier, lookup.payment, isAutomatic)
      /** A delivery none of its attempts was quoted for is told once and known from then
       *  on, so the attempts are looked for past it: it settles none of them, and each may
       *  still deliver. One an attempt of the user's was quoted for stays unknown, for
       *  their own retry to be told of. */
      const isOfNoAttempt =
        settled === undefined && !isDeliveryOfAnyAttempt(earlier, lookup.payment)
      if (isOfNoAttempt) {
        keepLost({
          ...earlier,
          knownPaymentIds: [...earlier.knownPaymentIds, lookup.payment.id],
        })
      }
      if (settled === undefined) {
        return failed(EARLIER_CONVERSION_MESSAGE, ConvertErrorCode.EarlierConversionFound)
      }
      keepLost(withoutAttempt(earlier, settled, lookup.payment))
      if (isThisConversion(lookup.payment)) return { status: PaymentResultStatus.Success }
      return failed(EARLIER_CONVERSION_MESSAGE, ConvertErrorCode.EarlierConversionFound)
    }
    /** Not found so soon after it went out, it may still deliver. */
    if (canStillDeliver(earlier.lastAttemptAtMs)) {
      return failed(OUTCOME_UNKNOWN_MESSAGE, ConvertErrorCode.OutcomeUnknown)
    }
  }
  /** What was decided before the turn came is asked again now, when no other conversion
   *  in the wallet can go out. The user confirmed theirs against a balance that one of
   *  about its amount, gone out while it waited, has spent: auto-convert's of a receive
   *  they meant to convert themselves, or their own sent twice. Theirs is not sent, and
   *  they confirm again against what is left. Auto-convert asks the history instead, since
   *  two receives of one amount are two conversions. */
  const amountIn = toNumber(estimate.amountIn)
  const isLikeThisOne = (out: ConversionOut) =>
    out.direction === params.direction && isAboutAmount(out.amountIn, amountIn)
  const shouldConfirmAgain = !isAutomatic && wentOutMeanwhile.some(isLikeThisOne)
  if (shouldConfirmAgain) {
    return failed(ALREADY_CONVERTED_MESSAGE, ConvertErrorCode.AlreadyConverted)
  }
  /** Auto-convert's receive may have been converted meanwhile, by the user included.
   *  Unanswered, nothing is converted. */
  if (isConvertedMeanwhile) {
    const isConverted = await isConvertedMeanwhile().catch((err: unknown) => {
      recordConvertError(err, params, "isConvertedMeanwhile")
      return undefined
    })
    if (isConverted === undefined) {
      return failed(HISTORY_UNAVAILABLE_MESSAGE, ConvertErrorCode.HistoryUnavailable)
    }
    if (isConverted) {
      return failed(ALREADY_CONVERTED_MESSAGE, ConvertErrorCode.AlreadyConverted)
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
  const thisDelivery: ExpectedDelivery = {
    tokenIdentifier: deliveredTokenOf(params.direction),
    amount: toNumber(estimate.amountOut),
    amountIn: toNumber(estimate.amountIn),
    isAutomatic,
  }
  /** What this conversion leaves to be looked for should its outcome be lost: with the
   *  lost conversion it was let through past, from the earlier mark, since either may
   *  deliver. */
  const lost: LostConversion = {
    ...(earlier ?? { startedAtMs, ...mark }),
    knownPaymentIds: [
      ...new Set([...(earlier?.knownPaymentIds ?? []), ...mark.knownPaymentIds]),
    ],
    expectedDeliveries: [...(earlier?.expectedDeliveries ?? []), thisDelivery],
    lastAttemptAtMs: startedAtMs,
  }
  /** Stored before the conversion goes out, and waited for a moment: the app can be
   *  closed with it in flight, and the next launch must look for it before converting
   *  again. Not stored in time, it does not go out; the end of its turn takes it back. */
  const writtenAhead = attempts.writeAhead((current) => ({
    ...current,
    lostConversion: lost,
  }))
  const isStoredAhead = await writtenAhead.written
  if (!isStoredAhead) {
    return failed(HISTORY_UNAVAILABLE_MESSAGE, ConvertErrorCode.HistoryUnavailable)
  }

  try {
    const response = await sdk.sendPayment(
      SendPaymentRequest.create({ prepareResponse: prepared }),
    )
    /** Answered, it leaves nothing to look for: taken back before anything else is
     *  stored. */
    writtenAhead.end()
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
    /** Failed, as sends are: the SDK hands back the delivery it waited for, which a swap
     *  that expired or was returned leaves failed. Nothing delivered settles nothing, so
     *  the lost conversion it was let through past is still looked for. */
    const isConversionFailed = response?.payment?.status === PaymentStatus.Failed
    if (isConversionFailed) {
      return failed(CONVERSION_FAILED_MESSAGE, ConvertErrorCode.ConversionFailed)
    }
    /** Out, it settles the lost conversion it was let through past. */
    if (earlier) keepLost(undefined)
    return { status: PaymentResultStatus.Success }
  } catch (err) {
    /** When its outcome was lost: a swap that ran late in a long call delivers from then. */
    const lostAtRealMs = performance.now()
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
     *  earlier mark: either may have delivered by now. What was stored ahead stays
     *  stored meanwhile, and is taken back only once what the look leaves is held. */
    const look = await findLostConversion({ sdk, lost })
    const { left, isSurelyThis } = settledByLook(look, lost, {
      isAutomatic,
      isThisConversion,
    })
    /** Kept, it is looked for again within its window, counted from when it was lost. */
    if (left) firstKnownAt.set(left.lastAttemptAtMs, lostAtRealMs)
    keepLost(left)
    writtenAhead.end()
    if (isSurelyThis) {
      measureIn(startedIn, ScEvent.SwapCompleted, swapTelemetry)
      return { status: PaymentResultStatus.Success }
    }
    reportSwapFailed()
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
    execute: (options) =>
      executePrepared(sdk, { prepared, estimate, startedIn, params, ...options }),
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
