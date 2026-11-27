/* eslint-disable camelcase */
import {
  FeePolicy,
  OnchainConfirmationSpeed,
  PaymentStatus,
  type BreezSdkInterface,
  type ConversionOptions,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import {
  GetFee,
  IdempotencyKeyRef,
  PaymentSendExtraInfo,
  SendPaymentMutation,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import {
  toBtcMoneyAmount,
  type MoneyAmount,
  type WalletAmount,
  type WalletOrDisplayCurrency,
} from "@app/types/amounts"
import { FeeTierOption } from "@app/types/fee-tiers"
import { ConvertAmountAdjustment } from "@app/types/payment"
import { reportError } from "@app/utils/error-logging"

/** GetFee result plus the SDK dust adjustment, kept behind the self-custodial port so the shared GetFee contract stays free of it. */
export type SelfCustodialFeeResult<T extends WalletCurrency> = Awaited<
  ReturnType<GetFee<T>>
> & {
  amountAdjustment?: ConvertAmountAdjustment
}

import {
  assertFeePolicyApplied,
  executeSend,
  extractLightningFee,
  extractOnchainFees,
  hasTokenLeg,
  identifyPreparedSend,
  mapAmountAdjustment,
  prepareSend,
  type PreparedTokenLegs,
  type SendIdentity,
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

import {
  grantSendAnyway,
  lostAttemptsFor,
  takeSendAnyway,
  withoutSettled,
  type LostAttempts,
  type LostAttemptsHandle,
  type LostSend,
  type RequestedAs,
  type SettledAttempts,
  type UnresolvedSend,
} from "./lost-attempts"

import {
  CODES_RAISED_BEFORE_DISPATCH,
  findLostSend,
  findPaymentUnderKey,
  htlcDetailsOf,
  isPaymentOfLostSend,
  readWalletClockSec,
  sparkInvoiceOf,
  type LostSendLookup,
} from "./lost-send"

type PrepareParams = {
  sdk: BreezSdkInterface
  paymentRequest: string
  amount: bigint | undefined
  tokenIdentifier?: string
  conversionOptions?: ConversionOptions
  feePolicy?: FeePolicy
}

/**
 * A send-all on the Bitcoin wallet: the SDK takes the fee out of the balance, so the
 * wallet spends exactly what it holds. The Dollar wallet's send-all converts on the way
 * out and waits on the SDK's answer for how the fee meets that (#2048 SA5).
 */
export const sendAllFeePolicy = (
  sendMax: boolean | undefined,
  currency: WalletCurrency,
): FeePolicy | undefined =>
  sendMax && currency === WalletCurrency.Btc ? FeePolicy.FeesIncluded : undefined

/** What went out, for a send whose fee came out of the amount: review only had a quote,
 *  and the SDK prepares the send again (blink-wip#2048 SR2). */
export const settledOf = (
  requested: FeePolicy | undefined,
  payment: Payment | undefined,
): PaymentSendExtraInfo | undefined =>
  requested === FeePolicy.FeesIncluded && payment
    ? { settled: { amountSats: Number(payment.amount), feeSats: Number(payment.fees) } }
    : undefined

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

/** What a self-custodial send reports: the params every event carries, and how it
 *  settles. */
export type SelfCustodialSendTelemetry = {
  params: ScEventParams
  settlement: SettlementTelemetry
}

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
  feePolicy: params.feePolicy,
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
      assertFeePolicyApplied(params.feePolicy, prepared)
      const feeSats = extractLightningFee(prepared) ?? 0
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
      assertFeePolicyApplied(params.feePolicy, prepared)
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

type SendRail = { scope: string; confirmationSpeed?: OnchainConfirmationSpeed }

/**
 * How a send mutation reports itself, and the payment detail's key ref: the send hook
 * mints the idempotency key into it before every attempt and a retry reads the same one
 * back, so a bitcoin send retried after a throw is refused by the SDK as a duplicate
 * rather than paid twice.
 */
export type SendMutationOptions = {
  telemetry: SendTelemetry
  idempotencyKeyRef?: IdempotencyKeyRef
  /** What the sender asked the send for; left out when the destination fixes the
   *  amount. */
  requestedAs?: RequestedAs
}

/**
 * What a sender asked a send for: as they entered it, by the code of the currency they
 * entered it in (a fiat one is told by its code alone), and as it leaves the wallet, by
 * the wallet's currency, never its code: sats entered on the keypad are coded `SAT`, the
 * same sats converted from fiat `BTC`.
 */
export const requestedAsOf = (
  entered: MoneyAmount<WalletOrDisplayCurrency>,
  settlement: MoneyAmount<WalletCurrency>,
): RequestedAs => ({
  entered: `${entered.currencyCode}:${entered.amount}`,
  settlement: `${settlement.currency}:${settlement.amount}`,
})

const runSendMutation = (
  params: PrepareParams,
  { telemetry, idempotencyKeyRef = {}, requestedAs }: SendMutationOptions,
  { scope, confirmationSpeed }: SendRail,
): ReturnType<SendPaymentMutation> =>
  runSelfCustodialSend({
    sdk: params.sdk,
    idempotencyKeyRef,
    destination: params.paymentRequest,
    requestedAs,
    telemetry: {
      params: telemetryParams(telemetry),
      settlement: sendSettlement(telemetryParams(telemetry)),
    },
    prepare: async () => {
      const prepared = await prepareSend(params.sdk, toPrepareOptions(params))
      assertFeePolicyApplied(params.feePolicy, prepared)
      return prepared
    },
    identify: identifyPreparedSend,
    execute: (prepared, idempotencyKey) =>
      executeSend(params.sdk, prepared, { confirmationSpeed, idempotencyKey }),
    sentOutcome: ({ payment }) => ({
      status: PaymentSendResult.Success,
      extraInfo: settledOf(params.feePolicy, payment),
    }),
    foundOutcome: (payment) => ({
      status: PaymentSendResult.Success,
      extraInfo: settledOf(params.feePolicy, payment),
    }),
    failure: (err) => ({
      status: PaymentSendResult.Failure,
      errors: [reportSendFailure(scope, err)],
    }),
  })

export const createSendMutation = (
  params: PrepareParams,
  options: SendMutationOptions,
): SendPaymentMutation => {
  return () =>
    runSendMutation(params, options, { scope: "Self-custodial Lightning send" })
}

export const createSendMutationOnchain = (
  params: PrepareParams,
  feeTier: FeeTierOption,
  options: SendMutationOptions,
): SendPaymentMutation => {
  return () =>
    runSendMutation(params, options, {
      scope: "Self-custodial onchain send",
      confirmationSpeed: TIER_TO_SPEED[feeTier],
    })
}

/** The key what an attempt was asked for is kept under: what its payment is found by. */
const identityKeyOf = ({
  paymentHash,
  sparkInvoice,
}: SendIdentity): string | undefined => {
  if (paymentHash !== undefined) return `hash:${paymentHash}`
  if (sparkInvoice !== undefined) return `invoice:${sparkInvoice}`
  return undefined
}

/** The same key, read off a payment found in the wallet's history. */
const identityKeyOfPayment = (payment: Payment): string | undefined =>
  identityKeyOf({
    paymentHash: htlcDetailsOf(payment)?.paymentHash,
    sparkInvoice: sparkInvoiceOf(payment),
  })

/** What the attempts were asked for, once this attempt's request is added. */
const withRequest = (
  requestedAs: Record<string, RequestedAs> | undefined,
  identity: SendIdentity,
  request: RequestedAs | undefined,
): Record<string, RequestedAs> | undefined => {
  const identityKey = identityKeyOf(identity)
  const isRecorded = identityKey !== undefined && request !== undefined
  if (!isRecorded) return requestedAs
  return { ...requestedAs, [identityKey]: request }
}

const withItem = (items: ReadonlyArray<string>, item: string | undefined): string[] => {
  const isAlreadyIn = item === undefined || items.includes(item)
  return isAlreadyIn ? [...items] : [...items, item]
}

/**
 * The lost attempts once this one is added. The key is kept only while every attempt went
 * out under the same one: a retry under it is then refused by the SDK as a duplicate of
 * all of them, and of none of them otherwise.
 */
const withAttempt = (
  earlier: LostSend | undefined,
  {
    startedAtMs,
    walletClockSec,
    identity,
    idempotencyKey,
    requestedAs,
  }: {
    startedAtMs: number
    walletClockSec: number
    identity: SendIdentity
    idempotencyKey: string | undefined
    requestedAs?: RequestedAs
  },
): LostSend => {
  const isKeyChanged = earlier !== undefined && earlier.idempotencyKey !== idempotencyKey
  return {
    startedAtMs: earlier?.startedAtMs ?? startedAtMs,
    lastAttemptAtMs: Math.max(
      earlier?.lastAttemptAtMs ?? earlier?.startedAtMs ?? startedAtMs,
      startedAtMs,
    ),
    walletClockSec: Math.min(earlier?.walletClockSec ?? walletClockSec, walletClockSec),
    paymentHashes: withItem(earlier?.paymentHashes ?? [], identity.paymentHash),
    sparkInvoices: withItem(earlier?.sparkInvoices ?? [], identity.sparkInvoice),
    idempotencyKey: isKeyChanged ? undefined : idempotencyKey,
    requestedAs: withRequest(earlier?.requestedAs, identity, requestedAs),
  }
}

type SendOutcome = Awaited<ReturnType<SendPaymentMutation>>

/**
 * Drops the key a payment that failed for good went out under, so the send hook mints a
 * new one for the next attempt: under the old key the SDK would only hand the failed
 * payment back. Left alone if the hook has moved on to another key meanwhile.
 */
const startKeyOver = (
  idempotencyKeyRef: IdempotencyKeyRef,
  sentKey: string | undefined,
) => {
  const isSentKeyStillCurrent =
    sentKey !== undefined && idempotencyKeyRef.current === sentKey
  if (isSentKeyStillCurrent) idempotencyKeyRef.current = undefined
}

/**
 * An attempt's outcome could not be checked: the sender is pointed at their history.
 * `sendAnyway` lets them send again once they have looked, offered only when their
 * history is what can answer it: an attempt with nothing the wallet could ever find it
 * by. One the wallet could not read this time is asked about again on the next try.
 */
const outcomeUnknown = (sendAnyway?: () => void): SendOutcome => ({
  status: PaymentSendResult.Failure,
  errors: [
    {
      __typename: "GraphQLApplicationError",
      message: SelfCustodialErrorCode.OutcomeUnknown,
    },
  ],
  extraInfo: { checkHistory: true, sendAnyway },
})

/**
 * Whether a payment found in the wallet is another send to the destination than this one:
 * the attempt that made it was asked for another amount than this send, both as entered
 * and as it leaves the wallet. Unknown on either side (a destination that fixes the
 * amount, or an attempt recorded before requests were), it is taken for this send, as
 * before.
 */
const isAnotherSendThan = (
  foundRequest: RequestedAs | undefined,
  thisRequest: RequestedAs | undefined,
): boolean => {
  const isComparable = foundRequest !== undefined && thisRequest !== undefined
  if (!isComparable) return false
  const isSameAmount =
    foundRequest.entered === thisRequest.entered ||
    foundRequest.settlement === thisRequest.settlement
  return !isSameAmount
}

/** What the lost attempt that made a payment found in the wallet was asked for. */
const requestOf = (lost: LostSend, payment: Payment): RequestedAs | undefined => {
  const identityKey = identityKeyOfPayment(payment)
  if (identityKey === undefined) return undefined
  return lost.requestedAs?.[identityKey]
}

/** What a payment found in the wallet accounts for among lost attempts: the attempt that
 *  paid its own invoice, by its payment hash or Spark invoice, and no other. Any other
 *  attempt, for whatever amount, may have paid as well. */
const onlyAttemptOf = (payment: Payment): SettledAttempts => ({
  lostSend: {
    startedAtMs: 0,
    walletClockSec: 0,
    paymentHashes: withItem([], htlcDetailsOf(payment)?.paymentHash),
    sparkInvoices: withItem([], sparkInvoiceOf(payment)),
  },
})

/**
 * An earlier attempt's payment to the destination, made for another amount: reported as
 * that payment, for the sender to look at, and not as this send. This send was not paid
 * by it: either it never went out, or it went out, was lost, and is remembered to be
 * looked for before the next send to the destination goes out.
 */
const earlierPaymentOutcome = (payment: Payment): SendOutcome => ({
  status: PaymentSendResult.Failure,
  errors: [
    {
      __typename: "GraphQLApplicationError",
      message: SelfCustodialErrorCode.EarlierPaymentFound,
    },
  ],
  extraInfo: { earlierPaymentId: payment.id },
})

/** What one attempt reports once its outcome is known: the measurement context it began
 *  in, and how it settles. */
type AttemptTelemetry = { startedIn: number; settlement: SettlementTelemetry }

const beginAttempt = (telemetry: SelfCustodialSendTelemetry): AttemptTelemetry => {
  const startedIn = measurementGeneration()
  measure(ScEvent.PaymentSendInitiated, telemetry.params)
  return { startedIn, settlement: telemetry.settlement }
}

const reportFailed = (
  attempt: AttemptTelemetry,
  telemetry: SelfCustodialSendTelemetry,
  err: unknown,
) =>
  measureIn(attempt.startedIn, ScEvent.PaymentSendFailed, {
    ...telemetry.params,
    error_code: classifySdkError(err),
  })

/**
 * The telemetry of each attempt still owed an outcome, by what its payment can be found by
 * (the invoice's payment hash, the Spark invoice, or the key it went out under, which the
 * SDK records as the payment's id). Kept apart from the lost attempts, which are payment
 * safety: a payment found on a later look reports what its own attempt would have, not
 * the send that found it. Telemetry only, and bounded: an attempt that falls out, or one
 * with nothing to find it by, is simply not reported.
 */
const ATTEMPT_TELEMETRY_CAP = 100
const attemptTelemetry = new Map<string, AttemptTelemetry>()

const telemetryKeysOf = (
  identity: SendIdentity | undefined,
  idempotencyKey: string | undefined,
): string[] => [
  ...(identity?.paymentHash ? [`hash:${identity.paymentHash}`] : []),
  ...(identity?.sparkInvoice ? [`invoice:${identity.sparkInvoice}`] : []),
  ...(idempotencyKey ? [`id:${idempotencyKey.toLowerCase()}`] : []),
]

const rememberAttemptTelemetry = (
  keys: ReadonlyArray<string>,
  attempt: AttemptTelemetry,
) =>
  keys.forEach((key) => {
    if (attemptTelemetry.size >= ATTEMPT_TELEMETRY_CAP) {
      const oldest = attemptTelemetry.keys().next().value
      if (oldest !== undefined) attemptTelemetry.delete(oldest)
    }
    attemptTelemetry.set(key, attempt)
  })

const forgetAttemptTelemetry = (attempt: AttemptTelemetry) =>
  attemptTelemetry.forEach((held, key) => {
    if (held === attempt) attemptTelemetry.delete(key)
  })

/** The attempt that made this payment reports how it ended, once. */
const reportOutcomeOf = (payment: Payment) => {
  const attempt = [
    htlcDetailsOf(payment)?.paymentHash && `hash:${htlcDetailsOf(payment)?.paymentHash}`,
    sparkInvoiceOf(payment) && `invoice:${sparkInvoiceOf(payment)}`,
    `id:${payment.id.toLowerCase()}`,
  ]
    .map((key) => (key ? attemptTelemetry.get(key) : undefined))
    .find((held) => held !== undefined)
  if (!attempt) return
  forgetAttemptTelemetry(attempt)
  measureSettlement(payment, attempt.settlement, attempt.startedIn)
}

/** Each attempt whose payment a look saw failed has ended, and reports so: the look
 *  passes it over as not the send landing, which would otherwise leave that attempt
 *  waiting forever for an outcome. */
const withFailedReported = (lookup: LostSendLookup): LostSendLookup => {
  if (lookup.status !== "unreadable") lookup.failed.forEach(reportOutcomeOf)
  return lookup
}

type RunSelfCustodialSendParams<
  P extends PreparedTokenLegs,
  R extends { payment: Payment },
> = {
  sdk: BreezSdkInterface
  /** The payment detail's holder of the key the send hook minted for this payment. */
  idempotencyKeyRef: IdempotencyKeyRef
  /** Where the send goes: what its lost attempts are remembered under. */
  destination: string
  telemetry: SelfCustodialSendTelemetry
  prepare: () => Promise<P>
  identify: (prepared: P) => SendIdentity | undefined
  execute: (prepared: P, idempotencyKey: string | undefined) => Promise<R>
  /** What the sender asked the send for, as they entered it; left out when the
   *  destination fixes the amount, which leaves nothing to tell apart. */
  requestedAs?: RequestedAs
  /** What a send the SDK made reports, once it is known not to have failed. */
  sentOutcome: (result: R) => SendOutcome
  /** The wallet's own record of a send an earlier or this attempt made, reported as the
   *  send itself would have reported it. */
  foundOutcome: (payment: Payment) => SendOutcome
  failure: (err: unknown) => SendOutcome
}

/**
 * One attempt of a self-custodial send, made so a retry can never pay twice.
 *
 * A bitcoin send carries the payment's idempotency key, and a retry under it is refused
 * by the SDK as a duplicate. A send with a token leg cannot carry one (the SDK rejects
 * it), so the SDK's own warning applies: "retrying after a failure that leaves the
 * outcome unknown may pay twice … look for the payment before sending it again". Such a
 * send that throws after dispatch looks for its payment before it is reported as failed,
 * and the next send to the same destination looks for every earlier attempt's payment
 * before it goes out, unless it is a retry under the key they all went out with.
 *
 * Whether the send carries the key is read from the prepared payment, never from what
 * was asked for: the SDK can add a conversion to a bitcoin send on its own.
 *
 * A send that carries nothing to look for it by (a bare Spark or bitcoin address) and
 * throws after dispatch is sent again only under the key it went out with, or once the
 * wallet shows that keyed attempt never went out. Otherwise the sender is told the outcome
 * is unknown and pointed at their history instead.
 */
export const runSelfCustodialSend = <
  P extends PreparedTokenLegs,
  R extends { payment: Payment },
>(
  params: RunSelfCustodialSendParams<P, R>,
): Promise<SendOutcome> => {
  /** Taken once: a send that finishes after a switch of wallet settles its own wallet's
   *  attempts, not the next one's. */
  const attempts = lostAttemptsFor(params.destination)
  /** Read when the send is asked for, not when its turn comes: a send ahead of it that
   *  failed for good starts the shared key over. A repeat of the same send (a double tap
   *  the screen did not stop in time) carries the same key, and joins the send still
   *  queued or in flight under it rather than going out again: one with a token leg has
   *  no key the SDK could refuse it by. */
  const invocationKey = params.idempotencyKeyRef.current
  return attempts.oneAtATime(
    () => sendAfterEarlierAttempts(attempts, params, invocationKey),
    invocationKey,
  )
}

/** The send itself, alone among the sends to its destination. */
const sendAfterEarlierAttempts = async <
  P extends PreparedTokenLegs,
  R extends { payment: Payment },
>(
  attempts: LostAttemptsHandle,
  {
    sdk,
    idempotencyKeyRef,
    telemetry,
    prepare,
    identify,
    execute,
    requestedAs,
    sentOutcome,
    foundOutcome: reportedAsSent,
    failure,
  }: RunSelfCustodialSendParams<P, R>,
  invocationKey: string | undefined,
): Promise<SendOutcome> => {
  /** Nothing is sent while the attempts an earlier launch lost have not been read back:
   *  one of them may be this send's, paid already. A read that failed is read again
   *  first, and a write that failed is tried again too. Nothing is known lost either, so
   *  the sender is only asked to try again in a moment. */
  await attempts.retryStorage()
  if (!attempts.isStoredRead()) {
    return failure(new Error("Lost attempts of an earlier launch not read back yet"))
  }

  const { lostSend: earlier } = attempts.read()
  let unresolved = attempts.read().unresolvedSend
  /** The sender chose to send anyway past the unresolved attempt: this send goes out
   *  without asking about it, and settles it only once it does go out. */
  const isSentAnyway = takeSendAnyway(unresolved)

  /**
   * The earlier attempts this send accounts for, settled once it has an outcome, and only
   * those: a send settles what it answered for, nothing more. `lookedFor`: those
   * its own looks found nothing of. `retriedUnder`: those let through as retries under
   * the key they went out with, or because the sender chose to send anyway, which it
   * accounts for only if it does go out.
   */
  let lookedFor: SettledAttempts = {}
  let retriedUnder: SettledAttempts = {}
  const settle = (...settled: SettledAttempts[]) =>
    attempts.update((current) => settled.reduce(withoutSettled, current))

  /**
   * The wallet's record of a send an earlier attempt or this one made, with the telemetry
   * of the attempt that paid it (asked for `foundRequest`). For this send, it is reported
   * as the send (`settleAsThisSend`); made for another amount, as the earlier payment it
   * is (`asEarlierSend`, by default; `settleAsEarlierSend`). Either way it settles its own
   * attempt, and no other: every other one may have paid too, and stays to be looked for
   * before anything more goes out. Only this send, found to have gone out, also settles
   * what it went out past, as it would have had its answer come back.
   */
  const reportFound = (
    payment: Payment,
    {
      foundRequest,
      settleAsThisSend,
      settleAsEarlierSend,
      asEarlierSend = earlierPaymentOutcome,
    }: {
      foundRequest: RequestedAs | undefined
      settleAsThisSend: () => void
      settleAsEarlierSend: () => void
      asEarlierSend?: (payment: Payment) => SendOutcome
    },
  ): SendOutcome => {
    reportOutcomeOf(payment)
    const isAnotherSend = isAnotherSendThan(foundRequest, requestedAs)
    if (isAnotherSend) {
      settleAsEarlierSend()
      return asEarlierSend(payment)
    }
    settleAsThisSend()
    return reportedAsSent(payment)
  }

  /** Lets the sender, once they have checked their history, send to the destination again
   *  despite an attempt whose outcome could not be checked: the next send goes out past
   *  it, and the attempt stays until that send does go out. */
  const sendAnywayAfter = (sent: UnresolvedSend) => () => grantSendAnyway(sent)

  const findThisSend = (lost: LostSend) =>
    findLostSend({
      sdk,
      startedAtMs: lost.startedAtMs,
      walletClockSec: lost.walletClockSec,
      matches: (payment) => isPaymentOfLostSend(lost, payment),
    }).then(withFailedReported)

  /**
   * Whether an attempt with nothing to look it up by went out. One made under a key is
   * the SDK's payment with that key as its id, so the wallet's history answers it once
   * it has caught up: found, it is this send's outcome; read to its end without it, the
   * attempt never went out and the send may go. One made without a key, or a history
   * that could not be read, leaves the outcome unknown.
   */
  const settleUnresolved = async (
    sent: UnresolvedSend,
    isAfterFailedQuote: boolean,
  ): Promise<SendOutcome | undefined> => {
    const sentKey = sent.idempotencyKey
    if (sentKey === undefined) return outcomeUnknown(sendAnywayAfter(sent))

    const look = withFailedReported(await findPaymentUnderKey({ sdk, key: sentKey }))
    /** No way past it: the attempt is the SDK's payment under its key, which the next
     *  look can still find, and a history that cannot be read cannot be checked by the
     *  sender either. After a quote that failed, nothing is sent either way, and the
     *  quote's failure is what the sender can act on; the attempt stays all the same. */
    if (look.status === "unreadable") {
      if (isAfterFailedQuote) return undefined
      return outcomeUnknown()
    }

    unresolved = undefined
    if (look.status === "found") {
      /** Found under its own key, the payment is that attempt's, whichever send it is. */
      return reportFound(look.payment, {
        foundRequest: sent.requestedAs,
        settleAsThisSend: () => settle(lookedFor, { unresolvedSend: sent }),
        settleAsEarlierSend: () => settle({ unresolvedSend: sent }),
      })
    }
    settle({ unresolvedSend: sent })
    return undefined
  }

  /**
   * What the earlier attempts to this destination leave in the way of sending under `key`:
   * a refusal, the payment one of them made, or nothing. A retry under the key they all
   * went out with is refused by the SDK as a duplicate, so it is let through without a
   * look, where a look could only hold back a safe retry; the send then accounts for
   * them. Anything else is looked for first, whatever this send is: the lost attempt's
   * payment is as real after a switch of wallet or a new amount. `isAfterFailedQuote`:
   * the send could not be quoted, so it goes out in no case and only a payment found
   * stands in its way.
   */
  let hasLooked = false
  const clearEarlierAttempts = async (
    key: string | undefined,
    { isAfterFailedQuote = false } = {},
  ): Promise<SendOutcome | undefined> => {
    const isRetryUnder = (sentWith: string | undefined) =>
      key !== undefined && sentWith === key
    const unresolvedNow = unresolved
    const isUnresolvedLetThrough =
      isSentAnyway || isRetryUnder(unresolvedNow?.idempotencyKey)
    const mustAskAboutUnresolved = unresolvedNow !== undefined && !isUnresolvedLetThrough
    if (mustAskAboutUnresolved) {
      const refusal = await settleUnresolved(unresolvedNow, isAfterFailedQuote)
      if (refusal) return refusal
    }
    if (unresolved) retriedUnder = { ...retriedUnder, unresolvedSend: unresolved }
    const hasNothingToLookFor = !earlier || hasLooked
    if (hasNothingToLookFor) return undefined
    if (isRetryUnder(earlier.idempotencyKey)) {
      retriedUnder = { ...retriedUnder, lostSend: earlier }
      return undefined
    }

    hasLooked = true
    const look = await findThisSend(earlier)
    /** Nothing is sent over a history that could not be read: the payment it may hold
     *  would be paid again. The attempt stays remembered, and the next retry asks again.
     *  After a quote that failed, nothing is sent either way, and the quote's failure is
     *  what the sender can act on. */
    if (look.status === "unreadable") {
      if (isAfterFailedQuote) return undefined
      return failure(look.error)
    }
    lookedFor = { ...lookedFor, lostSend: earlier }
    if (look.status === "found") {
      /** Nothing goes out, so the payment found settles its own attempt and no other,
       *  whichever send it is reported as. */
      const settleItsAttempt = () => settle(onlyAttemptOf(look.payment))
      return reportFound(look.payment, {
        foundRequest: requestOf(earlier, look.payment),
        settleAsThisSend: settleItsAttempt,
        settleAsEarlierSend: settleItsAttempt,
      })
    }
    return undefined
  }

  /** Whether the send carries the key is read from the prepared payment. What stands in
   *  the way even if it does is settled before anything is quoted. */
  const blockedAtBest = await clearEarlierAttempts(invocationKey)
  if (blockedAtBest) return blockedAtBest

  /** The wallet's clock, read alongside the quote, so it is most often known by the time
   *  the send goes out, for the attempt stored before it does. */
  let walletClockKnown: number | undefined
  const walletClockRead = readWalletClockSec(sdk).then((walletClockSec) => {
    walletClockKnown = walletClockSec
    return walletClockSec
  })

  /** Nothing has moved before the send itself, so a quote that fails is safe to report
   *  as a failure and try again. It can fail because a lost attempt this retry was let
   *  through for already spent the funds, though: that attempt is looked for then, so
   *  the payment it made is reported rather than the quote's failure. */
  let prepared: P
  try {
    prepared = await prepare()
  } catch (err) {
    retriedUnder = {}
    const recovered = await clearEarlierAttempts(undefined, { isAfterFailedQuote: true })
    if (recovered) return recovered
    reportFailed(beginAttempt(telemetry), telemetry, err)
    return failure(err)
  }

  /** A send that goes out without the key is no retry under it: what was let through as
   *  one is looked for after all. */
  const idempotencyKey = hasTokenLeg(prepared) ? undefined : invocationKey
  if (idempotencyKey === undefined) retriedUnder = {}
  const blocked = await clearEarlierAttempts(idempotencyKey)
  if (blocked) return blocked

  const identity = identify(prepared)
  const startedAtMs = Date.now()
  /** A new payment is about to be made: telemetry counts it as a send of its own, in
   *  the context in effect now, and keeps how it reports by what it can be found by, so
   *  a payment that turns up on a later look reports as this attempt would have. */
  const attempt = beginAttempt(telemetry)
  rememberAttemptTelemetry(telemetryKeysOf(identity, idempotencyKey), attempt)

  /** What a send the SDK made reports. A throw while reporting it is no lost send: the
   *  payment was made, so it is reported as sent all the same, never kept as an attempt
   *  to look for, nor shown as a failure the sender would retry. */
  const reportSent = (result: R): SendOutcome => {
    try {
      return sentOutcome(result)
    } catch (err) {
      reportError("Self-custodial sent outcome", err)
      return { status: PaymentSendResult.Success }
    }
  }

  /** The bookkeeping after a send went out. A throw in it must not undo the send: the
   *  payment was made, so it is reported and the send goes on as sent. */
  const keepBooks = (payment: Payment | undefined) => {
    try {
      settle(lookedFor, retriedUnder)
      forgetAttemptTelemetry(attempt)
      measureSettlement(payment, attempt.settlement, attempt.startedIn)
    } catch (err) {
      reportError("Self-custodial send bookkeeping", err)
    }
  }

  const reportDispatched = (result: R): SendOutcome => {
    /** The SDK's types promise a payment, but a response without one has been seen:
     *  reported as sent, as the send itself would have been, with nothing to measure. */
    const payment: Payment | undefined = result?.payment
    keepBooks(payment)
    /** A failed payment is final, also when the SDK hands back the one an earlier
     *  attempt made under this key: the next attempt is a new payment, under a new key. */
    if (payment?.status === PaymentStatus.Failed) {
      startKeyOver(idempotencyKeyRef, idempotencyKey)
      return failure(new Error(`Payment ${payment.id} failed`))
    }
    return reportSent(result)
  }

  /** What this attempt leaves to be looked for before the next send to the destination,
   *  should its outcome be lost: by what it paid, or, with nothing to find it by, as an
   *  attempt whose outcome is unresolved. */
  const unresolvedAttempt: UnresolvedSend = {
    idempotencyKey,
    recordedAtMs: startedAtMs,
    requestedAs,
  }
  const attemptAt = (walletClockSec: number) => ({
    startedAtMs,
    walletClockSec,
    idempotencyKey,
    requestedAs,
  })
  const lostAttemptAt =
    (walletClockSec: number) =>
    (current: LostAttempts): LostAttempts =>
      identity
        ? {
            ...current,
            lostSend: withAttempt(current.lostSend, {
              ...attemptAt(walletClockSec),
              identity,
            }),
          }
        : { ...current, unresolvedSend: unresolvedAttempt }

  /** Stored before the send goes out, and waited for a moment: the app can be closed with
   *  the send in flight, and the next launch must look for it before paying again. Not
   *  stored in time, it does not go out; the end of its turn takes it back. The wallet's
   *  clock goes with it once read, if it was not yet. */
  const writtenAhead = attempts.writeAhead(lostAttemptAt(walletClockKnown ?? 0))
  const isClockStillToCome = identity !== undefined && walletClockKnown === undefined
  if (isClockStillToCome) {
    walletClockRead.then((walletClockSec) =>
      writtenAhead.update(lostAttemptAt(walletClockSec)),
    )
  }
  const isStoredAhead = await writtenAhead.written
  if (!isStoredAhead) {
    return failure(new Error("Attempt not stored before the send"))
  }

  /** Only the SDK call itself decides whether the send went out, whether it rejects or
   *  throws on the spot: whatever is done with its answer afterwards runs outside, where
   *  a throw cannot be taken for a lost send. */
  const dispatch = await Promise.resolve()
    .then(() => execute(prepared, idempotencyKey))
    .then(
      (result) => ({ result }),
      (error: unknown) => ({ error }),
    )
  /** Answered, the attempt leaves nothing to look for: it is taken back before the
   *  bookkeeping stores anything. */
  if ("result" in dispatch) {
    writtenAhead.end()
    return reportDispatched(dispatch.result)
  }
  const err = dispatch.error
  const isRaisedBeforeDispatch = CODES_RAISED_BEFORE_DISPATCH.has(classifySdkError(err))
  /** The SDK refused it on the way in: this attempt ends here as a failure, whatever is
   *  kept for payment safety. Any other throw leaves the outcome unknown, and telemetry
   *  waits for the payment to turn up, or to be seen failed. */
  if (isRaisedBeforeDispatch) {
    forgetAttemptTelemetry(attempt)
    reportFailed(attempt, telemetry, err)
  }

  if (!identity) {
    if (isRaisedBeforeDispatch) return failure(err)
    attempts.update((current) => ({ ...current, unresolvedSend: unresolvedAttempt }))
    if (idempotencyKey) return failure(err)
    /** No "send anyway" yet: the history cannot show this payment until the wallet has
     *  caught up. It is offered on the next try, once the sender has had time to look. */
    return outcomeUnknown()
  }

  /** Not looked for now when a retry under the same key is refused as a duplicate by
   *  the SDK anyway, nor when the SDK refused the send on the way in. Remembered all
   *  the same, in both cases: a new amount or wallet starts the key over, whether
   *  anything was dispatched is the SDK's word and not this code's, and the send made
   *  next has only the lookup between it and paying twice. */
  const walletClockSec = await walletClockRead
  const thisAttempt = { ...attemptAt(walletClockSec), identity }
  const withThisAttempt = lostAttemptAt(walletClockSec)
  const isLookedForNow = !idempotencyKey && !isRaisedBeforeDispatch
  if (isLookedForNow) {
    const thisAndEarlier = withAttempt(attempts.read().lostSend, thisAttempt)
    const lost = await findThisSend(thisAndEarlier)
    if (lost.status === "found") {
      /** A payment an earlier attempt made leaves this one unaccounted for: it may have
       *  paid as well, so it is remembered and looked for before the next send. For
       *  another amount, the sender is told it may have gone through. */
      const rememberThisSettlingFound = () =>
        attempts.update((current) =>
          withoutSettled(withThisAttempt(current), onlyAttemptOf(lost.payment)),
        )
      const isThisAttemptsPayment =
        identityKeyOfPayment(lost.payment) === identityKeyOf(identity)
      const settleAsThisSend = isThisAttemptsPayment
        ? () => settle(lookedFor, { lostSend: thisAndEarlier })
        : rememberThisSettlingFound
      return reportFound(lost.payment, {
        foundRequest: requestOf(thisAndEarlier, lost.payment),
        asEarlierSend: () => outcomeUnknown(),
        settleAsThisSend,
        settleAsEarlierSend: rememberThisSettlingFound,
      })
    }
  }
  attempts.update(withThisAttempt)
  return failure(err)
}
