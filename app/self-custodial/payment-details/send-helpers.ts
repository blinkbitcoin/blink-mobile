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
import { classifySdkError, SelfCustodialErrorCode } from "../sdk-error"

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

export const createSendMutation = (params: PrepareParams): SendPaymentMutation => {
  return async () => {
    try {
      const prepared = await prepareSend(params.sdk, toPrepareOptions(params))
      await executeSend(params.sdk, prepared)
      return { status: PaymentSendResult.Success }
    } catch (err) {
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
): SendPaymentMutation => {
  return async () => {
    try {
      const prepared = await prepareSend(params.sdk, toPrepareOptions(params))
      await executeSend(params.sdk, prepared, TIER_TO_SPEED[feeTier])
      return { status: PaymentSendResult.Success }
    } catch (err) {
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
  | { readonly status: "found"; readonly payment: Payment }
  /** The last look read the history to its end and none of it was the payment: the one
   *  answer that makes the send safe to try again. */
  | { readonly status: "not-found" }
  /** The last look could not read the history, or found a send it cannot tell apart from
   *  the attempt, so nothing is known: not the payment, and not its absence. The error
   *  it met is carried for the caller to report. */
  | { readonly status: "unreadable"; readonly error: unknown }

type HistoryScan = {
  readonly matches: Payment[]
  /** Whether the window holds a send the wallet has not described yet. Such a payment
   *  carries nothing to match on, and a Lightning send can sit that way until the
   *  wallet has fetched what it paid, so it may be the attempt itself. */
  readonly hasUndescribedSend: boolean
}

const isUndescribedSend = (payment: Payment): boolean =>
  payment.details === undefined && payment.status !== PaymentStatus.Failed

const isCompleted = (payment: Payment): boolean =>
  payment.status === PaymentStatus.Completed

const isPendingPayment = (payment: Payment): boolean =>
  payment.status === PaymentStatus.Pending

/** A match that is the attempt landing: a failed payment of the invoice is not one. */
const isLanded = (payment: Payment): boolean =>
  isCompleted(payment) || isPendingPayment(payment)

/**
 * One look: the wallet catches up with the server, then its outgoing payments in the
 * window are read page by page, until the caller's match is complete, the pages run
 * short, or the cap is hit. Throws when the history could not be read, except that a
 * page failing after a landed match was made takes nothing away from it: a payment of
 * the invoice exists. A failed match is not one, so the pages after it still count.
 */
const scanHistorySince = async (
  sdk: BreezSdkInterface,
  since: bigint,
  matches: (payment: Payment) => boolean,
): Promise<HistoryScan> => {
  await syncSelfCustodialWallet(sdk)

  const found: Payment[] = []
  let hasUndescribedSend = false
  for (let page = 0; page < LOST_SEND_MAX_PAGES; page += 1) {
    let payments: Payment[]
    try {
      ;({ payments } = await listSentPaymentsSince(sdk, {
        fromTimestamp: since,
        limit: LOST_SEND_PAGE_SIZE,
        offset: page * LOST_SEND_PAGE_SIZE,
      }))
    } catch (err) {
      if (found.some(isLanded)) return { matches: found, hasUndescribedSend }
      throw err
    }

    found.push(...payments.filter(matches))
    if (payments.some(isUndescribedSend)) hasUndescribedSend = true

    const isScanComplete =
      found.some(isCompleted) || payments.length < LOST_SEND_PAGE_SIZE
    if (isScanComplete) return { matches: found, hasUndescribedSend }
  }

  throw new Error(`Lost send lookup ran past ${LOST_SEND_MAX_PAGES} pages without an end`)
}

/**
 * The payment an attempt made in spite of throwing, "not-found" when the last look read
 * the history and showed none, or "unreadable" when it could not. A completed payment
 * outranks a pending one for the same attempt; a failed one is not the attempt landing,
 * so it is passed over.
 *
 * The last look decides, since each one reads the history afresh after the wallet caught
 * up: a look that could not read earlier says nothing about one that did later.
 */
export const findLostSend = async ({
  sdk,
  startedAtMs,
  matches,
}: FindLostSendParams): Promise<LostSendLookup> => {
  const since = BigInt(Math.floor(startedAtMs / 1000) - LOST_SEND_LOOKBACK_SECONDS)
  let lastLook: LostSendLookup = { status: "not-found" }

  for (let attempt = 1; attempt <= LOST_SEND_ATTEMPTS; attempt += 1) {
    try {
      const scan = await scanHistorySince(sdk, since, matches)
      const payment =
        scan.matches.find(isCompleted) ?? scan.matches.find(isPendingPayment)
      if (payment) return { status: "found", payment }
      lastLook = scan.hasUndescribedSend
        ? {
            status: "unreadable",
            error: new Error("Lost send lookup met an undescribed send"),
          }
        : { status: "not-found" }
    } catch (err) {
      reportError("Self-custodial lost send lookup", err)
      lastLook = { status: "unreadable", error: err }
    }

    const isLastAttempt = attempt === LOST_SEND_ATTEMPTS
    if (!isLastAttempt) await sleep(LOST_SEND_DELAY_MS)
  }

  return lastLook
}
