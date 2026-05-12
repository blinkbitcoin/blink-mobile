import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"
import { PaymentType } from "@blinkbitcoin/blink-client"
import { LnUrlPayServiceResponse } from "lnurl-pay"

import { WalletCurrency } from "@app/graphql/generated"
import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import {
  type CreatePaymentDetailParams,
  DestinationDirection,
  type ParseDestinationResult,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { toBtcMoneyAmount } from "@app/types/amounts"
import { PaymentType as SelfCustodialPaymentType } from "@app/types/transaction"

import { createSelfCustodialLightningPaymentDetails } from "./lightning"
import { createSelfCustodialLnurlPaymentDetails } from "./lnurl"
import { createSelfCustodialOnchainPaymentDetails } from "./onchain"
import { createSelfCustodialSparkPaymentDetails } from "./spark"

type WrapOptions = {
  feeTier?: FeeTierOption
}

type ValidDestination = Extract<
  ParseDestinationResult,
  { valid: true }
>["validDestination"]

type LightningDestination = Extract<
  ValidDestination,
  { paymentType: typeof PaymentType.Lightning }
>
type LnurlDestination = Extract<
  ValidDestination,
  { paymentType: typeof PaymentType.Lnurl; lnurlParams: LnUrlPayServiceResponse }
>
type OnchainDestination = Extract<
  ValidDestination,
  { paymentType: typeof PaymentType.Onchain }
>
type SparkDestination = Extract<
  ValidDestination,
  { paymentType: typeof SelfCustodialPaymentType.Spark }
>

type BuildArgs<T extends WalletCurrency, D extends ValidDestination> = {
  sdk: BreezSdkInterface
  destination: D
  params: CreatePaymentDetailParams<T>
  options: WrapOptions
}

const buildLightningDetail = <T extends WalletCurrency>({
  sdk,
  destination,
  params,
}: BuildArgs<T, LightningDestination>) => {
  const invoiceAmount =
    "amount" in destination && destination.amount ? destination.amount : 0
  const invoiceMemo = "memo" in destination ? destination.memo : undefined

  return createSelfCustodialLightningPaymentDetails({
    sdk,
    paymentRequest: destination.paymentRequest,
    unitOfAccountAmount: toBtcMoneyAmount(invoiceAmount),
    hasAmount: invoiceAmount > 0,
    ...params,
    destinationSpecifiedMemo: invoiceMemo,
  })
}

const buildLnurlDetail = <T extends WalletCurrency>({
  sdk,
  destination,
  params,
}: BuildArgs<T, LnurlDestination>) =>
  createSelfCustodialLnurlPaymentDetails({
    sdk,
    lnurl: destination.lnurl,
    lnurlParams: destination.lnurlParams,
    unitOfAccountAmount: toBtcMoneyAmount(destination.lnurlParams.min || 0),
    isMerchant: destination.isMerchant,
    destinationSpecifiedMemo: destination.lnurlParams.description,
    ...params,
  })

const buildSparkDetail = <T extends WalletCurrency>({
  sdk,
  destination,
  params,
}: BuildArgs<T, SparkDestination>) =>
  createSelfCustodialSparkPaymentDetails({
    sdk,
    address: destination.address,
    unitOfAccountAmount: toBtcMoneyAmount(0),
    ...params,
  })

const buildOnchainDetail = <T extends WalletCurrency>({
  sdk,
  destination,
  params,
  options,
}: BuildArgs<T, OnchainDestination>) =>
  createSelfCustodialOnchainPaymentDetails({
    sdk,
    address: destination.address,
    unitOfAccountAmount: toBtcMoneyAmount(0),
    feeTier: options.feeTier,
    ...params,
  })

export const wrapDestination = (
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
      switch (original.paymentType) {
        case PaymentType.Lightning:
          return buildLightningDetail({
            sdk,
            destination: original as LightningDestination,
            params,
            options,
          })
        case PaymentType.Lnurl:
          return buildLnurlDetail({
            sdk,
            destination: original as LnurlDestination,
            params,
            options,
          })
        case SelfCustodialPaymentType.Spark:
          return buildSparkDetail({
            sdk,
            destination: original as SparkDestination,
            params,
            options,
          })
        case PaymentType.Onchain:
          return buildOnchainDetail({
            sdk,
            destination: original as OnchainDestination,
            params,
            options,
          })
        default:
          return result.createPaymentDetail(params)
      }
    },
  }
}
