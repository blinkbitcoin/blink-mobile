import crashlytics from "@react-native-firebase/crashlytics"
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

import {
  executeSend,
  extractLightningFee,
  extractOnchainFees,
  prepareSend,
} from "../bridge"
import { classifySdkError } from "../sdk-error"

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

export const createGetFee = <T extends WalletCurrency>(
  params: PrepareParams,
): GetFee<T> => {
  return async () => {
    try {
      const prepared = await prepareSend(params.sdk, toPrepareOptions(params))
      const feeSats = extractLightningFee(prepared) ?? 0
      return { amount: asGetFeeAmount<T>(feeSats) }
    } catch {
      return { amount: undefined }
    }
  }
}

export const createGetFeeOnchain = <T extends WalletCurrency>(
  params: PrepareParams,
  feeTier: FeeTierOption,
): GetFee<T> => {
  return async () => {
    try {
      const prepared = await prepareSend(params.sdk, toPrepareOptions(params))
      const fees = extractOnchainFees(prepared)
      if (!fees) return { amount: undefined }

      return { amount: asGetFeeAmount<T>(fees[feeTier]) }
    } catch {
      return { amount: undefined }
    }
  }
}

const reportSendFailure = (
  scope: string,
  err: unknown,
): { __typename: "GraphQLApplicationError"; message: string } => {
  crashlytics().recordError(err instanceof Error ? err : new Error(`${scope}: ${err}`))
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
        errors: [reportSendFailure("Self-custodial Lightning send failed", err)],
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
        errors: [reportSendFailure("Self-custodial onchain send failed", err)],
      }
    }
  }
}
