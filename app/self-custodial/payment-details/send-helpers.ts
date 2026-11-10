import {
  OnchainConfirmationSpeed,
  PaymentStatus,
  SendPaymentMethod_Tags as MethodTag,
  type BreezSdkInterface,
  type ConversionOptions,
  type Payment,
  type PrepareSendPaymentResponse,
} from "@breeztech/breez-sdk-spark-react-native"

import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import {
  GetFee,
  IdempotencyKeyRef,
  SendPaymentMutation,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import { toBtcMoneyAmount, type WalletAmount } from "@app/types/amounts"
import { ConvertAmountAdjustment } from "@app/types/payment"
import { reportError } from "@app/utils/error-logging"

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
  hasTokenLeg,
  mapAmountAdjustment,
  prepareSend,
  type PreparedTokenLegs,
} from "../bridge"
import { classifySdkError, SelfCustodialErrorCode } from "../sdk-error"

import {
  lostAttemptsFor,
  withoutSettled,
  type LostAttemptsHandle,
  type LostSend,
  type SettledAttempts,
  type UnresolvedSend,
} from "./lost-attempts"
import {
  CODES_RAISED_BEFORE_DISPATCH,
  findLostSend,
  findPaymentUnderKey,
  isPaymentOfLostSend,
  readWalletClockSec,
} from "./lost-send"

type PrepareParams = {
  sdk: BreezSdkInterface
  paymentRequest: string
  amount: bigint | undefined
  tokenIdentifier?: string
  conversionOptions?: ConversionOptions
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

/**
 * What a prepared send can be found by in the wallet's history once dispatched: the
 * invoice's payment hash for Lightning, the invoice itself for a Spark invoice. A send to
 * a bare Spark or bitcoin address carries nothing no other payment shares.
 */
export const identifyPreparedSend = (
  prepared: PrepareSendPaymentResponse,
): SendIdentity | undefined => {
  const method = prepared.paymentMethod
  if (!method) return undefined
  if (method.tag === MethodTag.Bolt11Invoice) {
    return { paymentHash: method.inner.invoiceDetails.paymentHash }
  }
  if (method.tag === MethodTag.SparkInvoice) {
    return { sparkInvoice: method.inner.sparkInvoiceDetails.invoice }
  }
  return undefined
}

type SendRail = { scope: string; confirmationSpeed?: OnchainConfirmationSpeed }

const runSendMutation = (
  params: PrepareParams,
  idempotencyKeyRef: IdempotencyKeyRef,
  { scope, confirmationSpeed }: SendRail,
): ReturnType<SendPaymentMutation> =>
  runSelfCustodialSend({
    sdk: params.sdk,
    idempotencyKeyRef,
    destination: params.paymentRequest,
    prepare: () => prepareSend(params.sdk, toPrepareOptions(params)),
    identify: identifyPreparedSend,
    execute: (prepared, idempotencyKey) =>
      executeSend(params.sdk, prepared, { confirmationSpeed, idempotencyKey }),
    sentOutcome: () => ({ status: PaymentSendResult.Success }),
    foundOutcome: () => ({ status: PaymentSendResult.Success }),
    failure: (err) => ({
      status: PaymentSendResult.Failure,
      errors: [reportSendFailure(scope, err)],
    }),
  })

/**
 * The key ref is the payment detail's: the send hook mints the idempotency key into it
 * before every attempt and a retry reads the same one back, so a bitcoin send retried
 * after a throw is refused by the SDK as a duplicate rather than paid twice.
 */
export const createSendMutation = (
  params: PrepareParams,
  idempotencyKeyRef: IdempotencyKeyRef = {},
): SendPaymentMutation => {
  return () =>
    runSendMutation(params, idempotencyKeyRef, { scope: "Self-custodial Lightning send" })
}

export const createSendMutationOnchain = (
  params: PrepareParams,
  feeTier: FeeTierOption,
  idempotencyKeyRef: IdempotencyKeyRef = {},
): SendPaymentMutation => {
  return () =>
    runSendMutation(params, idempotencyKeyRef, {
      scope: "Self-custodial onchain send",
      confirmationSpeed: TIER_TO_SPEED[feeTier],
    })
}

/** What a dispatched send can be found by in the wallet's history. */
export type SendIdentity = { paymentHash?: string; sparkInvoice?: string }

const withItem = (items: ReadonlyArray<string>, item: string | undefined): string[] =>
  item === undefined || items.includes(item) ? [...items] : [...items, item]

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
  }: {
    startedAtMs: number
    walletClockSec: number
    identity: SendIdentity
    idempotencyKey: string | undefined
  },
): LostSend => ({
  startedAtMs: earlier?.startedAtMs ?? startedAtMs,
  walletClockSec: Math.min(earlier?.walletClockSec ?? walletClockSec, walletClockSec),
  paymentHashes: withItem(earlier?.paymentHashes ?? [], identity.paymentHash),
  sparkInvoices: withItem(earlier?.sparkInvoices ?? [], identity.sparkInvoice),
  idempotencyKey:
    earlier && earlier.idempotencyKey !== idempotencyKey ? undefined : idempotencyKey,
})

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
  if (sentKey !== undefined && idempotencyKeyRef.current === sentKey) {
    idempotencyKeyRef.current = undefined
  }
}

const outcomeUnknown = (): SendOutcome => ({
  status: PaymentSendResult.Failure,
  errors: [
    {
      __typename: "GraphQLApplicationError",
      message: SelfCustodialErrorCode.OutcomeUnknown,
    },
  ],
})

type RunSelfCustodialSendParams<
  P extends PreparedTokenLegs,
  R extends { payment: Payment },
> = {
  sdk: BreezSdkInterface
  /** The payment detail's holder of the key the send hook minted for this payment. */
  idempotencyKeyRef: IdempotencyKeyRef
  /** Where the send goes: what its lost attempts are remembered under. */
  destination: string
  prepare: () => Promise<P>
  identify: (prepared: P) => SendIdentity | undefined
  execute: (prepared: P, idempotencyKey: string | undefined) => Promise<R>
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
   *  failed for good starts the shared key over, and a repeat of the same send (a double
   *  tap the screen did not stop in time) must still go out under the key it was asked
   *  for, to be refused as the duplicate it is, never under none. */
  const invocationKey = params.idempotencyKeyRef.current
  return attempts.oneAtATime(() =>
    sendAfterEarlierAttempts(attempts, params, invocationKey),
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
    prepare,
    identify,
    execute,
    sentOutcome,
    foundOutcome,
    failure,
  }: RunSelfCustodialSendParams<P, R>,
  invocationKey: string | undefined,
): Promise<SendOutcome> => {
  const { lostSend: earlier } = attempts.read()
  let unresolved = attempts.read().unresolvedSend

  /**
   * The earlier attempts this send accounts for, settled once it has an outcome, and only
   * those: a send settles what it answered for, nothing more. `lookedFor`: those
   * its own looks found nothing of. `retriedUnder`: those let through as retries under
   * the key they went out with, which it accounts for only if it does go out under it.
   */
  let lookedFor: SettledAttempts = {}
  let retriedUnder: SettledAttempts = {}
  const settle = (...settled: SettledAttempts[]) =>
    attempts.update((current) => settled.reduce(withoutSettled, current))

  const findThisSend = (lost: LostSend) =>
    findLostSend({
      sdk,
      startedAtMs: lost.startedAtMs,
      walletClockSec: lost.walletClockSec,
      matches: (payment) => isPaymentOfLostSend(lost, payment),
    })

  /**
   * Whether an attempt with nothing to look it up by went out. One made under a key is
   * the SDK's payment with that key as its id, so the wallet's history answers it once
   * it has caught up: found, it is this send's outcome; read to its end without it, the
   * attempt never went out and the send may go. One made without a key, or a history
   * that could not be read, leaves the outcome unknown.
   */
  const settleUnresolved = async (
    sent: UnresolvedSend,
  ): Promise<SendOutcome | undefined> => {
    const sentKey = sent.idempotencyKey
    if (sentKey === undefined) return outcomeUnknown()

    const look = await findPaymentUnderKey({ sdk, key: sentKey })
    if (look.status === "unreadable") return outcomeUnknown()

    unresolved = undefined
    if (look.status === "found") {
      settle(lookedFor, { unresolvedSend: sent })
      return foundOutcome(look.payment)
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
   * payment is as real after a switch of wallet or a new amount.
   */
  let hasLooked = false
  const clearEarlierAttempts = async (
    key: string | undefined,
  ): Promise<SendOutcome | undefined> => {
    const isRetryUnder = (sentWith: string | undefined) =>
      key !== undefined && sentWith === key
    if (unresolved && !isRetryUnder(unresolved.idempotencyKey)) {
      const refusal = await settleUnresolved(unresolved)
      if (refusal) return refusal
    }
    if (unresolved) retriedUnder = { ...retriedUnder, unresolvedSend: unresolved }
    if (!earlier || hasLooked) return undefined
    if (isRetryUnder(earlier.idempotencyKey)) {
      retriedUnder = { ...retriedUnder, lostSend: earlier }
      return undefined
    }

    hasLooked = true
    const look = await findThisSend(earlier)
    /** Nothing is sent over a history that could not be read: the payment it may hold
     *  would be paid again. The attempt stays remembered, and the next retry asks again. */
    if (look.status === "unreadable") return failure(look.error)
    lookedFor = { ...lookedFor, lostSend: earlier }
    if (look.status === "found") {
      settle(lookedFor)
      return foundOutcome(look.payment)
    }
    return undefined
  }

  /** Whether the send carries the key is read from the prepared payment. What stands in
   *  the way even if it does is settled before anything is quoted. */
  const blockedAtBest = await clearEarlierAttempts(invocationKey)
  if (blockedAtBest) return blockedAtBest

  /** Nothing has moved before the send itself, so a quote that fails is safe to report
   *  as a failure and try again. It can fail because a lost attempt this retry was let
   *  through for already spent the funds, though: that attempt is looked for then, so
   *  the payment it made is reported rather than the quote's failure. */
  let prepared: P
  try {
    prepared = await prepare()
  } catch (err) {
    retriedUnder = {}
    const recovered = await clearEarlierAttempts(undefined)
    return recovered ?? failure(err)
  }

  /** A send that goes out without the key is no retry under it: what was let through as
   *  one is looked for after all. */
  const idempotencyKey = hasTokenLeg(prepared) ? undefined : invocationKey
  if (idempotencyKey === undefined) retriedUnder = {}
  const blocked = await clearEarlierAttempts(idempotencyKey)
  if (blocked) return blocked

  const identity = identify(prepared)
  const startedAtMs = Date.now()
  try {
    const result = await execute(prepared, idempotencyKey)
    settle(lookedFor, retriedUnder)
    /** A failed payment is final, also when the SDK hands back the one an earlier
     *  attempt made under this key: the next attempt is a new payment, under a new key. */
    if (result.payment.status === PaymentStatus.Failed) {
      startKeyOver(idempotencyKeyRef, idempotencyKey)
      return failure(new Error(`Payment ${result.payment.id} failed`))
    }
    return sentOutcome(result)
  } catch (err) {
    const isRaisedBeforeDispatch = CODES_RAISED_BEFORE_DISPATCH.has(classifySdkError(err))

    if (!identity) {
      if (isRaisedBeforeDispatch) return failure(err)
      attempts.update((current) => ({ ...current, unresolvedSend: { idempotencyKey } }))
      return idempotencyKey ? failure(err) : outcomeUnknown()
    }

    /** Not looked for now when a retry under the same key is refused as a duplicate by
     *  the SDK anyway, nor when the SDK refused the send on the way in. Remembered all
     *  the same, in both cases: a new amount or wallet starts the key over, whether
     *  anything was dispatched is the SDK's word and not this code's, and the send made
     *  next has only the lookup between it and paying twice. */
    const walletClockSec = await readWalletClockSec(sdk)
    const thisAttempt = { startedAtMs, walletClockSec, identity, idempotencyKey }
    if (!idempotencyKey && !isRaisedBeforeDispatch) {
      const thisAndEarlier = withAttempt(attempts.read().lostSend, thisAttempt)
      const lost = await findThisSend(thisAndEarlier)
      if (lost.status === "found") {
        settle(lookedFor, { lostSend: thisAndEarlier })
        return foundOutcome(lost.payment)
      }
    }
    attempts.update((current) => ({
      ...current,
      lostSend: withAttempt(current.lostSend, thisAttempt),
    }))
    return failure(err)
  }
}
