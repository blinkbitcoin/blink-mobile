import {
  OnchainConfirmationSpeed,
  type BreezSdkInterface,
  type ConversionOptions,
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
