import {
  OnchainConfirmationSpeed,
  type BreezSdkInterface,
} from "@breeztech/breez-sdk-spark-react-native"

import { PaymentSendResult, WalletCurrency } from "@app/graphql/generated"
import {
  GetFee,
  SendPaymentMutation,
} from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import { toWalletAmount } from "@app/types/amounts"

import { executeSend, extractOnchainFees, prepareSend } from "../bridge"

const LIGHTNING_FEE_SATS = 0

type PrepareParams = {
  sdk: BreezSdkInterface
  paymentRequest: string
  amount: bigint | undefined
  tokenIdentifier?: string
}

const TIER_TO_SPEED: Record<FeeTierOption, OnchainConfirmationSpeed> = {
  [FeeTierOption.Fast]: OnchainConfirmationSpeed.Fast,
  [FeeTierOption.Medium]: OnchainConfirmationSpeed.Medium,
  [FeeTierOption.Slow]: OnchainConfirmationSpeed.Slow,
}

const TIER_TO_FEE_KEY = {
  [FeeTierOption.Fast]: "fast",
  [FeeTierOption.Medium]: "medium",
  [FeeTierOption.Slow]: "slow",
} as const

const toPrepareOptions = (params: PrepareParams) => ({
  paymentRequest: params.paymentRequest,
  amount: params.amount,
  tokenIdentifier: params.tokenIdentifier,
})

export const createGetFee = <T extends WalletCurrency>(
  params: PrepareParams,
  currency: T,
): GetFee<T> => {
  return async () => {
    try {
      await prepareSend(params.sdk, toPrepareOptions(params))
      return {
        amount: toWalletAmount({ amount: LIGHTNING_FEE_SATS, currency }),
      }
    } catch {
      return { amount: undefined }
    }
  }
}

export const createGetFeeOnchain = <T extends WalletCurrency>(
  params: PrepareParams,
  currency: T,
  feeTier: FeeTierOption,
): GetFee<T> => {
  return async () => {
    try {
      const prepared = await prepareSend(params.sdk, toPrepareOptions(params))
      const fees = extractOnchainFees(prepared)
      const feeKey = TIER_TO_FEE_KEY[feeTier]
      const feeSats = fees ? fees[feeKey] : 0

      return {
        amount: toWalletAmount({ amount: feeSats, currency }),
      }
    } catch {
      return { amount: undefined }
    }
  }
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
        errors: [
          {
            __typename: "GraphQLApplicationError" as const,
            message: err instanceof Error ? err.message : `Send failed: ${err}`,
          },
        ],
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
        errors: [
          {
            __typename: "GraphQLApplicationError" as const,
            message: err instanceof Error ? err.message : `Send failed: ${err}`,
          },
        ],
      }
    }
  }
}
