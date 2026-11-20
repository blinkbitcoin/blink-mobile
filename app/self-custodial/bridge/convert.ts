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
import { withTimeout } from "@app/utils/with-timeout"

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
  type FoundUserTransfer,
  type LostAttemptsHandle,
  type LostConversion,
} from "../payment-details/lost-attempts"
import {
  CODES_RAISED_BEFORE_DISPATCH,
  findLostConversion,
  isDeliveryOfOwnConversion,
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

/**
 * How long a conversion waits on the SDK before it stops waiting, in the quote and in the
 * call that sends it. Conversions go out one at a time, so a call that never comes back
 * would otherwise hold every later one, auto-convert's and the user's alike, until the app
 * restarts. Only the wait is bounded: the call is left running, as cancelling SDK work
 * can wedge it. The quote's few calls answer within seconds; the send's waits for the swap
 * to complete, which the SDK itself gives up on after 30 seconds by default
 * (`completionTimeoutSecs`), and one past this bound goes down the path of a conversion
 * whose outcome was lost, looked for before anything converts again.
 */
const CONVERSION_QUOTE_TIMEOUT_MS = 60_000
const CONVERSION_SEND_TIMEOUT_MS = 90_000

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

/** What a delivery is told apart from another by: the way it went, what it paid in once
 *  the wallet has filled that in, and what it delivered. */
type DeliveryFacts = {
  direction?: ConvertDirection
  paidIn?: number
  amount: number
}

const deliveryFactsOf = (payment: Payment): DeliveryFacts => ({
  direction: directionDeliveredBy(payment),
  paidIn: paidInOf(payment),
  amount: toNumber(payment.amount),
})

/**
 * Whether what a lost conversion delivered is this conversion asked again rather than
 * another: the same way, paying in about as much, or, before the wallet has filled in
 * what it paid in, delivering about as much as this one is quoted to.
 */
const isDeliveryOf = (
  { direction, paidIn, amount }: DeliveryFacts,
  { estimate, params }: Pick<ConversionExecution, "estimate" | "params">,
): boolean => {
  if (direction !== params.direction) return false
  if (paidIn !== undefined) {
    return isAboutAmount(paidIn, toNumber(estimate.amountIn))
  }
  return isAboutDelivered(amount, toNumber(estimate.amountOut))
}

/** A transfer of the user's found delivered, as their next transfer is told of it. */
const foundUserTransferOf = (
  payment: Payment,
  isLabeled: boolean,
): FoundUserTransfer => ({
  paymentId: payment.id,
  ...deliveryFactsOf(payment),
  isLabeled,
  foundAtMs: Date.now(),
})

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
 * By this app launch's clock (`performance.now`), which only moves forward and which no
 * change of the phone's clock moves, when each lost conversion's latest attempt was first
 * known: when its outcome was lost, in this launch, or when this launch first read it
 * back. Keyed by that attempt's time. The clock counts the time the phone is awake: it may
 * stop while the phone sleeps, which only makes a window last longer.
 */
const firstKnownAt = new Map<number, number>()

/** How long, by that clock, this launch has known a lost conversion's latest attempt. */
const msKnownThisLaunch = (lastAttemptAtMs: number): number => {
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
 * out by this launch's clock. Never by the phone's clock, which a correction moves either
 * way: ahead, a conversion just sent would look long gone; back, conversions would stay
 * refused for as long as it was moved. This launch's clock cannot be read across app
 * launches, so a launch counts from when it first read the conversion back, never less
 * than the time that really passed, and a window can last longer than its five minutes,
 * never shorter.
 */
const canStillDeliver = (lastAttemptAtMs: number): boolean =>
  isWithinDeliveryWindow(msKnownThisLaunch(lastAttemptAtMs))

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
 *  it found is surely this conversion's delivery, which it then names. */
type SettledByLook = {
  left: LostConversion | undefined
  isSurelyThis: boolean
  deliveredPaymentId?: string
}

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
  return {
    left,
    isSurelyThis: isThisAttempt && !canBeAnotherAttempts,
    deliveredPaymentId: payment.id,
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
    isDeliveryOf(deliveryFactsOf(payment), { estimate, params })

  /** A lost transfer of the user's that auto-convert found delivered is told of on their
   *  next one, as the look would have told them had it found it: done when this one is
   *  it asked again, gone through when it is another, and to be checked when it is this
   *  one by a payment the wallet never labeled. Told once, the oldest first. */
  const foundTransfers = isAutomatic ? [] : attempts.read().foundUserTransfers ?? []
  const [foundTransfer, ...stillToTell] = foundTransfers
  if (foundTransfer) {
    attempts.update((current) => ({ ...current, foundUserTransfers: stillToTell }))
    const isThisTransfer = isDeliveryOf(foundTransfer, { estimate, params })
    const isThisTransferUnlabeled = isThisTransfer && !foundTransfer.isLabeled
    if (isThisTransferUnlabeled) {
      return failed(OUTCOME_UNKNOWN_MESSAGE, ConvertErrorCode.OutcomeUnknown)
    }
    if (isThisTransfer) {
      return {
        status: PaymentResultStatus.Success,
        deliveredPaymentId: foundTransfer.paymentId,
      }
    }
    return failed(EARLIER_CONVERSION_MESSAGE, ConvertErrorCode.EarlierConversionFound)
  }

  const earlier = attempts.read().lostConversion
  if (earlier) {
    /** Within its window a lost conversion may still deliver, and only a delivery the
     *  wallet has labeled as a conversion's proves it did: the SDK labels one whose
     *  answer it lost once it finds the swap ran, seconds after, on a later pass, or as it
     *  starts again, while a payment not labeled yet may be any receive of about that
     *  amount. Past the window, the conversion's own outcome is settled, and one still
     *  unlabeled is a delivery the SDK never recorded, as of a conversion it was stopped
     *  in the middle of. Read once, so that what the look takes and what not finding
     *  means agree. */
    const isWithinWindow = canStillDeliver(earlier.lastAttemptAtMs)
    const lookup = await findLostConversion({
      sdk,
      lost: earlier,
      isLabelRequired: isWithinWindow,
    })
    if (lookup.status === "unreadable") {
      return failed(OUTCOME_UNKNOWN_MESSAGE, ConvertErrorCode.OutcomeUnknown)
    }
    if (lookup.status === "found") {
      const { payment } = lookup
      /** Labeled as a conversion's delivery: always so within the window, whose look
       *  takes nothing else. Past it, one the wallet never labeled may be any receive of
       *  about that amount, as well as the delivery of a conversion the SDK was stopped in
       *  the middle of. */
      const isLabeled = isWithinWindow || isDeliveryOfOwnConversion(payment)
      const settled = settledAttemptOf(earlier, payment, isAutomatic)
      /** The attempt it delivers for, whoever made it, the user's first. */
      const deliveredFor = settledAttemptOf(earlier, payment, false)
      /** A delivery none of its attempts was quoted for is told once and known from then
       *  on, so the attempts are looked for past it: it settles none of them, and each may
       *  still deliver. */
      if (deliveredFor === undefined) {
        keepLost({
          ...earlier,
          knownPaymentIds: [...earlier.knownPaymentIds, payment.id],
        })
        return failed(EARLIER_CONVERSION_MESSAGE, ConvertErrorCode.EarlierConversionFound)
      }
      /** What auto-convert finds of the user's own is settled, and kept for their next
       *  transfer to be told of: left unsettled, every look would find it again, and no
       *  receive would convert until the user transferred once more. */
      if (settled === undefined) {
        attempts.update((current) => ({
          ...current,
          lostConversion: withoutAttempt(earlier, deliveredFor, payment),
          foundUserTransfers: [
            ...(current.foundUserTransfers ?? []),
            foundUserTransferOf(payment, isLabeled),
          ],
        }))
        return failed(EARLIER_CONVERSION_MESSAGE, ConvertErrorCode.EarlierConversionFound)
      }
      keepLost(withoutAttempt(earlier, settled, payment))
      /** This conversion's own only when the attempt it settles is this request asked
       *  again: the user's transfer, never auto-convert's, or auto-convert's of the same
       *  receive, since it converts receives of about one amount alike. Another one is
       *  told, and this one asked again once it is settled. */
      const isThisRequest =
        earlier.expectedDeliveries[settled].receiveRecordedAtMs ===
        params.receiveRecordedAtMs
      const isThisRequestsDelivery = isThisRequest && isThisConversion(payment)
      /** The user is asked to check their history rather than told their transfer is done
       *  by a payment that may be anyone's. Auto-convert takes it for its receive's
       *  conversion: converting the receive again would convert it twice were it the
       *  delivery. */
      const shouldAskTheUserToCheck = isThisRequestsDelivery && !isAutomatic && !isLabeled
      if (shouldAskTheUserToCheck) {
        return failed(OUTCOME_UNKNOWN_MESSAGE, ConvertErrorCode.OutcomeUnknown)
      }
      if (isThisRequestsDelivery) {
        return {
          status: PaymentResultStatus.Success,
          deliveredPaymentId: payment.id,
        }
      }
      return failed(EARLIER_CONVERSION_MESSAGE, ConvertErrorCode.EarlierConversionFound)
    }
    /** Not found so soon after it went out, it may still deliver. */
    if (isWithinWindow) {
      return failed(OUTCOME_UNKNOWN_MESSAGE, ConvertErrorCode.EarlierConversionPending)
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
    receiveRecordedAtMs: params.receiveRecordedAtMs,
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
    const response = await withTimeout(
      sdk.sendPayment(SendPaymentRequest.create({ prepareResponse: prepared })),
      CONVERSION_SEND_TIMEOUT_MS,
      "Conversion send",
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
    return {
      status: PaymentResultStatus.Success,
      deliveredPaymentId: response?.payment?.id,
    }
  } catch (err) {
    /** When its outcome was lost: a swap that ran late in a long call delivers from then. */
    const lostAtLaunchMs = performance.now()
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
     *  earlier mark: either may have delivered by now. This one has just gone out, so
     *  only a delivery the wallet has labeled counts, as within any window. What was
     *  stored ahead stays stored meanwhile, and is taken back only once what the look
     *  leaves is held. */
    const look = await findLostConversion({ sdk, lost, isLabelRequired: true })
    const { left, isSurelyThis, deliveredPaymentId } = settledByLook(look, lost, {
      isAutomatic,
      isThisConversion,
    })
    /** Kept, it is looked for again within its window, counted from when it was lost. */
    if (left) firstKnownAt.set(left.lastAttemptAtMs, lostAtLaunchMs)
    keepLost(left)
    writtenAhead.end()
    if (isSurelyThis) {
      measureIn(startedIn, ScEvent.SwapCompleted, swapTelemetry)
      return { status: PaymentResultStatus.Success, deliveredPaymentId }
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
      const context = await withTimeout(
        prepareConversion(sdk, params),
        CONVERSION_QUOTE_TIMEOUT_MS,
        "Conversion quote",
      )
      return toConvertQuote(sdk, { ...context, startedIn }, params)
    } catch (err) {
      recordConvertError(err, params, "getConversionQuote")
      throw err
    }
  }
