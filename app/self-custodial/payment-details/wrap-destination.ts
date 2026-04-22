import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { WalletCurrency } from "@app/graphql/generated"
import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers"
import {
  type CreatePaymentDetailParams,
  DestinationDirection,
  type ParseDestinationResult,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { toBtcMoneyAmount } from "@app/types/amounts"
import { PaymentType as SelfCustodialPaymentType } from "@app/types/transaction.types"

import { createSelfCustodialLightningPaymentDetails } from "./lightning"
import { createSelfCustodialOnchainPaymentDetails } from "./onchain"
import { createSelfCustodialSparkPaymentDetails } from "./spark"

type WrapOptions = {
  feeTier?: FeeTierOption
}

export const wrapDestinationForSC = (
  result: ParseDestinationResult,
  sdk: BreezSdkInterface,
  options: WrapOptions = {},
): ParseDestinationResult => {
  if (!result.valid) return result
  if (result.destinationDirection !== DestinationDirection.Send) return result

  const original = result.validDestination

  return {
    ...result,
    createPaymentDetail: <T extends WalletCurrency>(
      params: CreatePaymentDetailParams<T>,
    ) => {
      if (
        original.paymentType === PaymentType.Lightning ||
        original.paymentType === PaymentType.Lnurl
      ) {
        const invoiceAmount =
          "amount" in original && original.amount ? original.amount : 0
        const hasAmount = invoiceAmount > 0
        const invoiceMemo = "memo" in original ? original.memo : undefined

        return createSelfCustodialLightningPaymentDetails({
          sdk,
          paymentRequest:
            "paymentRequest" in original ? original.paymentRequest : original.lnurl,
          unitOfAccountAmount: toBtcMoneyAmount(invoiceAmount),
          hasAmount,
          ...params,
          destinationSpecifiedMemo: invoiceMemo,
        })
      }

      if (original.paymentType === SelfCustodialPaymentType.Spark) {
        return createSelfCustodialSparkPaymentDetails({
          sdk,
          address: original.address,
          unitOfAccountAmount: toBtcMoneyAmount(0),
          ...params,
        })
      }

      if (original.paymentType === PaymentType.Onchain) {
        return createSelfCustodialOnchainPaymentDetails({
          sdk,
          address: original.address,
          unitOfAccountAmount: toBtcMoneyAmount(0),
          feeTier: options.feeTier,
          ...params,
        })
      }

      return result.createPaymentDetail(params)
    },
  }
}
