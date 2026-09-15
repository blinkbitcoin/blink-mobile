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
 * sending it again"): the wallet is asked a few times, spaced out, because the payment
 * can land in the history a moment after the call that dispatched it gave up. The window
 * starts a little before the attempt's own clock, since the wallet stamps the payment.
 */
const LOST_SEND_ATTEMPTS = 3
const LOST_SEND_DELAY_MS = 2000
const LOST_SEND_LOOKBACK_SECONDS = 5
const LOST_SEND_PAGE_SIZE = 20

type FindLostSendParams = {
  sdk: BreezSdkInterface
  /** When the attempt was dispatched, in milliseconds. */
  startedAtMs: number
  /** Whether a payment in the history is the one this attempt was for. */
  matches: (payment: Payment) => boolean
}

/**
 * The payment an attempt made in spite of throwing, or undefined when the wallet shows
 * none: only then is the send safe to try again. A completed payment outranks a pending
 * one for the same attempt; a failed one is not the attempt landing, so it is passed over.
 * A history that cannot be read counts as nothing found, and the next attempt asks again.
 */
export const findLostSend = async ({
  sdk,
  startedAtMs,
  matches,
}: FindLostSendParams): Promise<Payment | undefined> => {
  const since = BigInt(Math.floor(startedAtMs / 1000) - LOST_SEND_LOOKBACK_SECONDS)

  for (let attempt = 1; attempt <= LOST_SEND_ATTEMPTS; attempt += 1) {
    let candidates: Payment[] = []
    try {
      const { payments } = await listSentPaymentsSince(sdk, since, LOST_SEND_PAGE_SIZE)
      candidates = payments.filter(matches)
    } catch (err) {
      reportError("Self-custodial lost send lookup", err)
    }

    const completed = candidates.find(({ status }) => status === PaymentStatus.Completed)
    const pending = candidates.find(({ status }) => status === PaymentStatus.Pending)
    const found = completed ?? pending
    if (found) return found

    const isLastAttempt = attempt === LOST_SEND_ATTEMPTS
    if (!isLastAttempt) await sleep(LOST_SEND_DELAY_MS)
  }

  return undefined
}
