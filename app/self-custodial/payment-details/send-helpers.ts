import {
  OnchainConfirmationSpeed,
  SendPaymentMethod_Tags as MethodTag,
  type BreezSdkInterface,
  type ConversionOptions,
  type Payment,
  type PrepareSendPaymentResponse,
} from "@breeztech/breez-sdk-spark-react-native"

import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import {
  GetFee,
  LostSend,
  SendAttemptRef,
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
  mapAmountAdjustment,
  prepareSend,
} from "../bridge"
import { classifySdkError, SelfCustodialErrorCode } from "../sdk-error"

import {
  CODES_RAISED_BEFORE_DISPATCH,
  findLostSend,
  isPaymentOfLostSend,
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
 * Whether a send carries no token leg, so the attempt's idempotency key can ride on it:
 * a bitcoin send that neither pays a token nor converts out of one on the way.
 */
const isKeyedSendOf = (params: PrepareParams): boolean =>
  params.tokenIdentifier === undefined && params.conversionOptions === undefined

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
  attemptRef: SendAttemptRef,
  { scope, confirmationSpeed }: SendRail,
): ReturnType<SendPaymentMutation> =>
  runSelfCustodialSend({
    sdk: params.sdk,
    attemptRef,
    isKeyedSend: isKeyedSendOf(params),
    prepare: () => prepareSend(params.sdk, toPrepareOptions(params)),
    identify: identifyPreparedSend,
    execute: async (prepared, idempotencyKey) => {
      await executeSend(params.sdk, prepared, { confirmationSpeed, idempotencyKey })
      return { status: PaymentSendResult.Success }
    },
    foundOutcome: () => ({ status: PaymentSendResult.Success }),
    failure: (err) => ({
      status: PaymentSendResult.Failure,
      errors: [reportSendFailure(scope, err)],
    }),
  })

/**
 * The attempt ref is the payment detail's: the send hook mints the idempotency key into
 * it before every attempt and a retry reads the same one back, so a bitcoin send retried
 * after a throw is refused by the SDK as a duplicate rather than paid twice.
 */
export const createSendMutation = (
  params: PrepareParams,
  attemptRef: SendAttemptRef = {},
): SendPaymentMutation => {
  return () =>
    runSendMutation(params, attemptRef, { scope: "Self-custodial Lightning send" })
}

export const createSendMutationOnchain = (
  params: PrepareParams,
  feeTier: FeeTierOption,
  attemptRef: SendAttemptRef = {},
): SendPaymentMutation => {
  return () =>
    runSendMutation(params, attemptRef, {
      scope: "Self-custodial onchain send",
      confirmationSpeed: TIER_TO_SPEED[feeTier],
    })
}

/** What a dispatched send can be found by in the wallet's history. */
export type SendIdentity = { paymentHash?: string; sparkInvoice?: string }

const withIdentity = (
  earlier: LostSend | undefined,
  startedAtMs: number,
  identity: SendIdentity,
): LostSend => ({
  startedAtMs,
  paymentHashes: [
    ...(earlier?.paymentHashes ?? []),
    ...(identity.paymentHash ? [identity.paymentHash] : []),
  ],
  sparkInvoices: [
    ...(earlier?.sparkInvoices ?? []),
    ...(identity.sparkInvoice ? [identity.sparkInvoice] : []),
  ],
})

type SendOutcome = Awaited<ReturnType<SendPaymentMutation>>

const outcomeUnknown = (): SendOutcome => ({
  status: PaymentSendResult.Failure,
  errors: [
    {
      __typename: "GraphQLApplicationError",
      message: SelfCustodialErrorCode.OutcomeUnknown,
    },
  ],
})

type RunSelfCustodialSendParams<P> = {
  sdk: BreezSdkInterface
  /** The payment detail's holder: the key the send hook minted, and what earlier
   *  attempts left behind. */
  attemptRef: SendAttemptRef
  /** Whether the send carries the attempt's idempotency key, so the SDK itself refuses a
   *  retry under it as a duplicate. False for any send with a token leg. */
  isKeyedSend: boolean
  prepare: () => Promise<P>
  identify: (prepared: P) => SendIdentity | undefined
  execute: (prepared: P, idempotencyKey: string | undefined) => Promise<SendOutcome>
  /** The wallet's own record of a send an earlier or this attempt made, reported as the
   *  send itself would have reported it. */
  foundOutcome: (payment: Payment) => SendOutcome
  failure: (err: unknown) => SendOutcome
}

/**
 * One attempt of a self-custodial send, made so a retry can never pay twice.
 *
 * A bitcoin send carries the attempt's idempotency key, and a retry under it is refused
 * by the SDK as a duplicate. A send with a token leg cannot carry one (the SDK rejects
 * it), so the SDK's own warning applies: "retrying after a failure that leaves the
 * outcome unknown may pay twice … look for the payment before sending it again". Such a
 * send that throws after dispatch looks for its payment before it is reported as failed,
 * and the next attempt looks for every earlier attempt's payment before it sends.
 *
 * A send that carries nothing to look for it by (a bare Spark or bitcoin address) and
 * throws after dispatch is never sent again except under the key it went out with: the
 * sender is told the outcome is unknown and pointed at their history instead.
 */
export const runSelfCustodialSend = async <P>({
  sdk,
  attemptRef,
  isKeyedSend,
  prepare,
  identify,
  execute,
  foundOutcome,
  failure,
}: RunSelfCustodialSendParams<P>): Promise<SendOutcome> => {
  const idempotencyKey = isKeyedSend ? attemptRef.current : undefined

  const unresolved = attemptRef.unresolvedSend
  const isRetryUnderSameKey =
    idempotencyKey !== undefined && unresolved?.idempotencyKey === idempotencyKey
  if (unresolved && !isRetryUnderSameKey) return outcomeUnknown()

  const findThisSend = (lost: LostSend) =>
    findLostSend({
      sdk,
      startedAtMs: lost.startedAtMs,
      matches: (payment) => isPaymentOfLostSend(lost, payment),
    })
  const forgetLostAttempts = () => {
    attemptRef.lostSend = undefined
    attemptRef.unresolvedSend = undefined
  }
  const rememberLostAttempts = (lostSend: LostSend) => {
    attemptRef.lostSend = lostSend
  }
  const rememberUnresolved = () => {
    attemptRef.unresolvedSend = { idempotencyKey }
  }

  /** Looked for whatever this send is: the lost attempt's payment is as real after a
   *  switch of wallet or a new amount. */
  const earlier = attemptRef.lostSend
  if (earlier) {
    const look = await findThisSend(earlier)
    if (look.status === "found") {
      forgetLostAttempts()
      return foundOutcome(look.payment)
    }
    /** Nothing is sent over a history that could not be read: the payment it may hold
     *  would be paid again. The attempt stays remembered, and the next retry asks again. */
    if (look.status === "unreadable") return failure(look.error)
  }

  /** Nothing has moved before the send itself, so a quote that fails is safe to report
   *  as a failure and try again. */
  let prepared: P
  try {
    prepared = await prepare()
  } catch (err) {
    return failure(err)
  }

  const identity = identify(prepared)
  const startedAtMs = earlier?.startedAtMs ?? Date.now()
  try {
    const outcome = await execute(prepared, idempotencyKey)
    forgetLostAttempts()
    return outcome
  } catch (err) {
    const isRaisedBeforeDispatch = CODES_RAISED_BEFORE_DISPATCH.has(classifySdkError(err))

    if (!identity) {
      if (isRaisedBeforeDispatch) return failure(err)
      rememberUnresolved()
      return isKeyedSend ? failure(err) : outcomeUnknown()
    }

    /** Not looked for now when a retry under the same key is refused as a duplicate by
     *  the SDK anyway, nor when the SDK refused the send on the way in. Remembered all
     *  the same, in both cases: a new amount or wallet starts the key over, whether
     *  anything was dispatched is the SDK's word and not this code's, and the send made
     *  next has only the lookup between it and paying twice. */
    const lostSend = withIdentity(earlier, startedAtMs, identity)
    if (!isKeyedSend && !isRaisedBeforeDispatch) {
      const lost = await findThisSend(lostSend)
      if (lost.status === "found") {
        forgetLostAttempts()
        return foundOutcome(lost.payment)
      }
    }
    rememberLostAttempts(lostSend)
    return failure(err)
  }
}

/** What a rebuild that starts the key over (a new amount, wallet or fee) carries from the
 *  attempt ref it replaces: everything but the key. */
export const carryLostAttempts = (ref: SendAttemptRef | undefined): SendAttemptRef => ({
  lostSend: ref?.lostSend,
  unresolvedSend: ref?.unresolvedSend,
})
