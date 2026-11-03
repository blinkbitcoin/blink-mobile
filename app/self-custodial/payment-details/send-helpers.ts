/* eslint-disable camelcase */
import {
  OnchainConfirmationSpeed,
  PaymentStatus,
  type BreezSdkInterface,
  type ConversionOptions,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import {
  GetFee,
  SendPaymentMutation,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import { toBtcMoneyAmount, type WalletAmount } from "@app/types/amounts"
import { ConvertAmountAdjustment } from "@app/types/payment"
import { reportError } from "@app/utils/error-logging"
import { sleep } from "@app/utils/sleep"
import { withTimeout } from "@app/utils/with-timeout"

/** GetFee result plus the SDK dust adjustment, kept behind the self-custodial port so the shared GetFee contract stays free of it. */
export type SelfCustodialFeeResult<T extends WalletCurrency> = Awaited<
  ReturnType<GetFee<T>>
> & {
  amountAdjustment?: ConvertAmountAdjustment
}

import {
  executeSend,
  extractLightningFee,
  extractOnchainFees,
  listSentPaymentsSince,
  mapAmountAdjustment,
  prepareSend,
  syncSelfCustodialWallet,
} from "../bridge"
import {
  measure,
  measureIn,
  measurementGeneration,
  measureSettlement,
  ScEvent,
  type ScEventParams,
  type ScRail,
  type SettlementTelemetry,
} from "../measurement"
import { classifySdkError, SelfCustodialErrorCode } from "../sdk-error"

type PrepareParams = {
  sdk: BreezSdkInterface
  paymentRequest: string
  amount: bigint | undefined
  tokenIdentifier?: string
  conversionOptions?: ConversionOptions
  /** The quote review showed, for a send that converts dollars on the way out. */
  quoteRef?: QuoteRef
}

/** What review showed for a dollar send: the fee, and the conversion behind it. */
export type SendQuote = { feeSats: number; amountIn?: string; amountOut?: string }
export type QuoteRef = { current?: SendQuote }

export const quoteOf = (
  feeSats: number,
  estimate: { amountIn: unknown; amountOut: unknown } | undefined,
): SendQuote => ({
  feeSats,
  amountIn: estimate ? String(estimate.amountIn) : undefined,
  amountOut: estimate ? String(estimate.amountOut) : undefined,
})

/**
 * Whether a dollar send's fresh quote differs from the one review showed. The price
 * moves the conversion, so a send that kept going would pay or deliver amounts the
 * sender never saw. A send with no quote on record has nothing to compare: review
 * always quotes before the slider can move.
 */
export const hasQuoteMoved = (reviewed: SendQuote | undefined, fresh: SendQuote) =>
  reviewed !== undefined &&
  (reviewed.feeSats !== fresh.feeSats ||
    reviewed.amountIn !== fresh.amountIn ||
    reviewed.amountOut !== fresh.amountOut)

/** A send stopped before anything went out, because its quote moved. */
export const quoteMovedFailure = () => ({
  status: PaymentSendResult.Failure,
  errors: [
    {
      __typename: "GraphQLApplicationError" as const,
      message: SelfCustodialErrorCode.QuoteMoved,
    },
  ],
})

/** What a send reports about itself: the rail category and the wallet spent from, never
 *  the destination, amount, or counterparty. */
export type SendTelemetry = {
  rail: ScRail
  sendingWallet: WalletCurrency
}

const telemetryParams = ({ rail, sendingWallet }: SendTelemetry): ScEventParams => ({
  rail,
  sending_wallet: sendingWallet,
})

/** A send settles or fails once, by the SDK's word; `alsoSettled` rides on the settle. */
export const sendSettlement = (
  params: ScEventParams,
  alsoSettled: SettlementTelemetry["settled"] = [],
): SettlementTelemetry => ({
  settled: [{ event: ScEvent.PaymentSendSettled, params }, ...alsoSettled],
  failed: { event: ScEvent.PaymentSendFailed, params },
})

const TIER_TO_SPEED: Record<FeeTierOption, OnchainConfirmationSpeed> = {
  [FeeTierOption.Fast]: OnchainConfirmationSpeed.Fast,
  [FeeTierOption.Medium]: OnchainConfirmationSpeed.Medium,
  [FeeTierOption.Slow]: OnchainConfirmationSpeed.Slow,
}

const toPrepareOptions = (params: PrepareParams) => ({
  paymentRequest: params.paymentRequest,
  amount: params.amount,
  tokenIdentifier: params.tokenIdentifier,
  conversionOptions: params.conversionOptions,
})

const asGetFeeAmount = <T extends WalletCurrency>(feeSats: number) =>
  toBtcMoneyAmount(feeSats) as unknown as WalletAmount<T>

/**
 * Quote failures the user resolves themselves by changing the amount. They are the common
 * way to fail a quote — the SDK adds the fee on top, so sending the full balance throws
 * InsufficientFunds — and a flow that ends in a successful send is not a defect, so they
 * stay breadcrumbs and leave the non-fatals to the failures actually worth chasing.
 */
const EXPECTED_FEE_CODES: ReadonlySet<SelfCustodialErrorCode> = new Set([
  SelfCustodialErrorCode.InsufficientFunds,
  SelfCustodialErrorCode.BelowMinimum,
])

/**
 * A fee quote the SDK could not produce. The classified code travels in `errors` so the
 * confirmation screen can name the cause — an unclassified failure leaves the user staring
 * at a generic "unable to calculate fee" with a disabled slider and no way forward.
 */
export const feeFailure = <T extends WalletCurrency>(
  scope: string,
  err: unknown,
): SelfCustodialFeeResult<T> => {
  const message = classifySdkError(err)
  reportError(scope, err, { expected: EXPECTED_FEE_CODES.has(message) })
  return {
    amount: undefined,
    errors: [{ __typename: "GraphQLApplicationError", message }],
  }
}

export const createGetFee = <T extends WalletCurrency>(
  params: PrepareParams,
): GetFee<T> => {
  return async (): Promise<SelfCustodialFeeResult<T>> => {
    try {
      const prepared = await prepareSend(params.sdk, toPrepareOptions(params))
      const feeSats = extractLightningFee(prepared) ?? 0
      if (params.quoteRef) {
        params.quoteRef.current = quoteOf(feeSats, prepared.conversionEstimate)
      }
      const amountAdjustment = mapAmountAdjustment(
        prepared.conversionEstimate?.amountAdjustment,
      )
      return { amount: asGetFeeAmount<T>(feeSats), amountAdjustment }
    } catch (err) {
      return feeFailure<T>("Self-custodial Lightning fee", err)
    }
  }
}

export const createGetFeeOnchain = <T extends WalletCurrency>(
  params: PrepareParams,
  feeTier: FeeTierOption,
): GetFee<T> => {
  return async (): Promise<SelfCustodialFeeResult<T>> => {
    try {
      const prepared = await prepareSend(params.sdk, toPrepareOptions(params))
      const fees = extractOnchainFees(prepared)
      if (!fees) {
        return feeFailure<T>(
          "Self-custodial onchain fee",
          new Error("prepareSend returned no BitcoinAddress fee quote"),
        )
      }

      return { amount: asGetFeeAmount<T>(fees[feeTier]) }
    } catch (err) {
      return feeFailure<T>("Self-custodial onchain fee", err)
    }
  }
}

const reportSendFailure = (
  scope: string,
  err: unknown,
): { __typename: "GraphQLApplicationError"; message: string } => {
  reportError(scope, err)
  return { __typename: "GraphQLApplicationError", message: classifySdkError(err) }
}

export const createSendMutation = (
  params: PrepareParams,
  telemetry: SendTelemetry,
): SendPaymentMutation => {
  return async () => {
    const startedIn = measurementGeneration()
    measure(ScEvent.PaymentSendInitiated, telemetryParams(telemetry))
    try {
      const prepared = await prepareSend(params.sdk, toPrepareOptions(params))
      if (
        params.quoteRef &&
        hasQuoteMoved(
          params.quoteRef.current,
          quoteOf(extractLightningFee(prepared) ?? 0, prepared.conversionEstimate),
        )
      ) {
        measureIn(startedIn, ScEvent.PaymentSendFailed, {
          ...telemetryParams(telemetry),
          error_code: SelfCustodialErrorCode.QuoteMoved,
        })
        return quoteMovedFailure()
      }
      const response = await executeSend(params.sdk, prepared)
      measureSettlement(
        response?.payment,
        sendSettlement(telemetryParams(telemetry)),
        startedIn,
      )
      return { status: PaymentSendResult.Success }
    } catch (err) {
      measureIn(startedIn, ScEvent.PaymentSendFailed, {
        ...telemetryParams(telemetry),
        error_code: classifySdkError(err),
      })
      return {
        status: PaymentSendResult.Failure,
        errors: [reportSendFailure("Self-custodial Lightning send", err)],
      }
    }
  }
}

export const createSendMutationOnchain = (
  params: PrepareParams,
  feeTier: FeeTierOption,
  telemetry: SendTelemetry,
): SendPaymentMutation => {
  return async () => {
    const startedIn = measurementGeneration()
    measure(ScEvent.PaymentSendInitiated, telemetryParams(telemetry))
    try {
      const prepared = await prepareSend(params.sdk, toPrepareOptions(params))
      const response = await executeSend(params.sdk, prepared, TIER_TO_SPEED[feeTier])
      measureSettlement(
        response?.payment,
        sendSettlement(telemetryParams(telemetry)),
        startedIn,
      )
      return { status: PaymentSendResult.Success }
    } catch (err) {
      measureIn(startedIn, ScEvent.PaymentSendFailed, {
        ...telemetryParams(telemetry),
        error_code: classifySdkError(err),
      })
      return {
        status: PaymentSendResult.Failure,
        errors: [reportSendFailure("Self-custodial onchain send", err)],
      }
    }
  }
}

/**
 * How a send whose outcome the SDK lost is looked for before it is treated as never made.
 *
 * The SDK's own guidance for a payment that throws after dispatch ("Retrying after a
 * failure that leaves the outcome unknown may pay twice … look for the payment before
 * sending it again"). The wallet's history is local, and a send that threw reaches it
 * only once the wallet has caught up with the server, so every look first asks it to,
 * and the looks are spaced out for the payment to land in between.
 *
 * The caller matches by something no other payment shares (the invoice's payment hash),
 * so the window only bounds the work. It opens a day before the attempt's own clock,
 * since the wallet stamps a payment with the server's clock and a phone's can be set
 * well ahead of it, and it is paged through to its end, so a busy wallet cannot push the
 * payment past the first page.
 */
const LOST_SEND_ATTEMPTS = 3
const LOST_SEND_DELAY_MS = 2000
/**
 * How long one look may spend inside the SDK before it is abandoned. Without it the lookup
 * is bounded in attempts but not in time: the SDK calls are awaited with nothing to stop
 * them, so one that never comes back leaves the whole lookup pending and the send with no
 * outcome at all — the one answer worse than "unreadable". It is not hypothetical here,
 * because a sync waits for an exit-chain collection pass (`collect_exit_chains`).
 * Three looks and two waits put the whole lookup under a minute.
 *
 * The wait is all it bounds. The SDK call it gave up on is left running, because
 * cancelling a user sync wedges the SDK's sync coordinator for as long as the wallet
 * stays connected (see `syncSelfCustodialWallet`). A later look's sync does not join that
 * one: the coordinator drains its waiter batch before running the sync and notifies only
 * that batch, so a caller arriving afterwards is served by the next pass of the loop
 * (`sdk/sync_coordinator.rs` @0.23.1, unchanged at 0.27.1). What that leaves behind is a
 * look whose own work carries on after nothing is waiting for it, which is what
 * `isExpired` is for.
 */
const LOST_SEND_ATTEMPT_TIMEOUT_MS = 15_000
const LOST_SEND_LOOKBACK_SECONDS = 24 * 60 * 60
const LOST_SEND_PAGE_SIZE = 50
/** Far beyond what a wallet sends in the window: hitting it means the pages never got
 *  shorter, and a history that was not read to its end is one that was not read. */
const LOST_SEND_MAX_PAGES = 20

type FindLostSendParams = {
  sdk: BreezSdkInterface
  /** When the attempt was dispatched, in milliseconds. */
  startedAtMs: number
  /** Whether a payment in the history is one this attempt may have made. */
  matches: (payment: Payment) => boolean
}

export type LostSendLookup =
  | {
      readonly status: "found"
      readonly payment: Payment
      /** Matches that ended failed, each the end of an attempt: for telemetry only, since
       *  none of them is the attempt landing. */
      readonly failed: ReadonlyArray<Payment>
    }
  /** The last look read the history to its end and none of it was the payment: the one
   *  answer that makes the send safe to try again. */
  | { readonly status: "not-found"; readonly failed: ReadonlyArray<Payment> }
  /** The last look could not read the history, or found a send it cannot tell apart from
   *  the attempt, so nothing is known: not the payment, and not its absence. The error
   *  it met is carried for the caller to report. */
  | { readonly status: "unreadable"; readonly error: unknown }

type HistoryScan = {
  matches: Payment[]
  /** Whether the window holds a send the wallet has not described yet. Such a payment
   *  carries nothing to match on, and a Lightning send can sit that way until the
   *  wallet has fetched what it paid, so it may be the attempt itself. */
  hasUndescribedSend: boolean
  /** Set when the wallet could not catch up with the server first. The local history
   *  can still show the payment, but not that it is absent. */
  syncFailure?: { readonly error: unknown }
}

const isUndescribedSend = (payment: Payment): boolean =>
  payment.details === undefined && payment.status !== PaymentStatus.Failed

const isCompleted = (payment: Payment): boolean =>
  payment.status === PaymentStatus.Completed

const isPendingPayment = (payment: Payment): boolean =>
  payment.status === PaymentStatus.Pending

const isFailedPayment = (payment: Payment): boolean =>
  payment.status === PaymentStatus.Failed

/**
 * One look: the wallet catches up with the server, then its outgoing payments in the
 * window are read page by page, until the pages run short or the cap is hit. A completed
 * match does not end it: an older attempt's failed payment may sit on a later page, and
 * that attempt reports its end only once it is seen. Throws when the history could not
 * be read, except that a page failing, or the cap, after a landed match was made takes
 * nothing away from it: a payment of the invoice exists. A failed match is not one, so
 * the pages after it still count.
 */
type ScanHistoryParams = {
  sdk: BreezSdkInterface
  since: bigint
  matches: (payment: Payment) => boolean
  /** Filled as the pages come in rather than returned at the end, so what a look already
   *  saw outlives the look itself. A page that fails, a history with no end, and a look
   *  abandoned at its deadline all leave the caller whatever the pages before showed. */
  into: HistoryScan
  /** Whether the look that owns this scan is already over. The SDK calls cannot be
   *  cancelled, so an abandoned look keeps running inside them and would come back long
   *  afterwards to read a history nobody is waiting for — a burst of paging at exactly
   *  the moment the wallet is busy catching up. Checked between awaits instead. */
  isExpired: () => boolean
}

const scanHistorySince = async ({
  sdk,
  since,
  matches,
  into,
  isExpired,
}: ScanHistoryParams): Promise<void> => {
  /**
   * The sync also waits for exit-chain collection, and fails when that does, while the
   * history it would have refreshed may already hold the payment. So a failed sync does
   * not end the look; it only rules out "not-found".
   */
  try {
    await syncSelfCustodialWallet(sdk)
  } catch (err) {
    reportError("Self-custodial lost send lookup", err)
    into.syncFailure = { error: err }
  }
  if (isExpired()) return

  for (let page = 0; page < LOST_SEND_MAX_PAGES; page += 1) {
    const { payments } = await listSentPaymentsSince(sdk, {
      fromTimestamp: since,
      limit: LOST_SEND_PAGE_SIZE,
      offset: page * LOST_SEND_PAGE_SIZE,
    })

    into.matches.push(...payments.filter(matches))
    if (payments.some(isUndescribedSend)) into.hasUndescribedSend = true

    if (payments.length < LOST_SEND_PAGE_SIZE || isExpired()) return
  }

  throw new Error(`Lost send lookup ran past ${LOST_SEND_MAX_PAGES} pages without an end`)
}

/** What a look that showed no payment of the attempt is able to say. */
const withoutPayment = (
  { syncFailure, hasUndescribedSend }: HistoryScan,
  failed: ReadonlyArray<Payment>,
): LostSendLookup => {
  if (syncFailure) return { status: "unreadable", error: syncFailure.error }
  if (hasUndescribedSend) {
    return {
      status: "unreadable",
      error: new Error("Lost send lookup met an undescribed send"),
    }
  }
  return { status: "not-found", failed }
}

/**
 * The payment an attempt made in spite of throwing, "not-found" when the last look read
 * the history and showed none, or "unreadable" when it could not. A completed payment
 * outranks a pending one for the same attempt; a failed one is not the attempt landing,
 * so it is passed over.
 *
 * The last look decides, since each one reads the history afresh after the wallet caught
 * up: a look that could not read earlier says nothing about one that did later.
 *
 * Every look is bounded in time as well, so a wallet that never answers ends the lookup
 * rather than suspending it: an abandoned look is one that could not read the history,
 * which is "unreadable" and never "not-found", so it can still never make a send look
 * safe to repeat.
 */
export const findLostSend = async ({
  sdk,
  startedAtMs,
  matches,
}: FindLostSendParams): Promise<LostSendLookup> => {
  const since = BigInt(Math.floor(startedAtMs / 1000) - LOST_SEND_LOOKBACK_SECONDS)
  let lastLook: LostSendLookup = { status: "not-found", failed: [] }

  for (let attempt = 1; attempt <= LOST_SEND_ATTEMPTS; attempt += 1) {
    const scan: HistoryScan = { matches: [], hasUndescribedSend: false }
    /** Set once this look has its answer, so the work still running inside it stops at
     *  its next await rather than paging a history nobody will read. */
    let isOver = false
    /** A payment of the invoice that the pages already showed is evidence, and nothing
     *  afterwards unshows it: not a page that fails, not a history without an end, and
     *  not the look running out of time. Read before the failure is reported, so the one
     *  thing a look is for is never lost to the way the look ended. */
    const landed = () =>
      scan.matches.find(isCompleted) ?? scan.matches.find(isPendingPayment)
    try {
      await withTimeout(
        scanHistorySince({
          sdk,
          since,
          matches,
          into: scan,
          isExpired: () => isOver,
        }),
        LOST_SEND_ATTEMPT_TIMEOUT_MS,
        "Self-custodial lost send lookup",
      )
      const payment = landed()
      const failed = scan.matches.filter(isFailedPayment)
      if (payment) return { status: "found", payment, failed }
      lastLook = withoutPayment(scan, failed)
    } catch (err) {
      const payment = landed()
      /** The failed ones are only the ones this look reached: telemetry a later look can
       *  still complete, where the payment itself cannot wait. */
      if (payment)
        return { status: "found", payment, failed: scan.matches.filter(isFailedPayment) }
      reportError("Self-custodial lost send lookup", err)
      lastLook = { status: "unreadable", error: err }
    } finally {
      isOver = true
    }

    const isLastAttempt = attempt === LOST_SEND_ATTEMPTS
    if (!isLastAttempt) await sleep(LOST_SEND_DELAY_MS)
  }

  return lastLook
}
