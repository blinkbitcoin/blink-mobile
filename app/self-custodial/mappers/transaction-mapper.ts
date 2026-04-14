import {
  PaymentDetails,
  PaymentDetails_Tags as PaymentDetailsTags,
  PaymentMethod,
  PaymentStatus,
  PaymentType as SdkPaymentType,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { tokenBaseUnitsToCents, toWalletMoneyAmount } from "@app/types/amounts"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction.types"
import { AccountType } from "@app/types/wallet.types"
import { toNumber } from "@app/utils/helper"

const mapPaymentMethod = (
  method: PaymentMethod,
  details?: Payment["details"],
): PaymentType => {
  if (details?.tag === PaymentDetailsTags.Token) return PaymentType.Conversion
  if (method === PaymentMethod.Lightning) return PaymentType.Lightning
  if (method === PaymentMethod.Spark) return PaymentType.Spark
  if (method === PaymentMethod.Deposit) return PaymentType.Onchain
  if (method === PaymentMethod.Withdraw) return PaymentType.Onchain
  return PaymentType.Lightning
}

const mapDirection = (paymentType: SdkPaymentType): TransactionDirection => {
  if (paymentType === SdkPaymentType.Send) return TransactionDirection.Send
  return TransactionDirection.Receive
}

const mapStatus = (status: PaymentStatus): TransactionStatus => {
  if (status === PaymentStatus.Completed) return TransactionStatus.Completed
  if (status === PaymentStatus.Pending) return TransactionStatus.Pending
  return TransactionStatus.Failed
}

const mapCurrency = (details?: Payment["details"]): WalletCurrency => {
  if (details?.tag === PaymentDetailsTags.Token) return WalletCurrency.Usd
  return WalletCurrency.Btc
}

const getTokenDecimals = (details?: Payment["details"]): number => {
  if (!details || !PaymentDetails.Token.instanceOf(details)) return 0
  return details.inner.metadata.decimals
}

const toDisplayAmount = (
  rawAmount: number,
  currency: WalletCurrency,
  tokenDecimals: number,
): number => {
  if (currency === WalletCurrency.Btc) return rawAmount
  return tokenBaseUnitsToCents(rawAmount, tokenDecimals)
}

const extractMemo = (payment: Payment): string | undefined => {
  if (!payment.details) return undefined

  if (PaymentDetails.Lightning.instanceOf(payment.details)) {
    return payment.details.inner.description ?? undefined
  }

  if (PaymentDetails.Spark.instanceOf(payment.details)) {
    return payment.details.inner.invoiceDetails?.description ?? undefined
  }

  if (PaymentDetails.Token.instanceOf(payment.details)) {
    return payment.details.inner.invoiceDetails?.description ?? undefined
  }

  return undefined
}

const extractLnAddress = (payment: Payment): string | undefined => {
  if (!payment.details || !PaymentDetails.Lightning.instanceOf(payment.details)) {
    return undefined
  }
  return payment.details.inner.lnurlPayInfo?.lnAddress ?? undefined
}

const extractTokenTicker = (payment: Payment): string | undefined => {
  if (!payment.details || !PaymentDetails.Token.instanceOf(payment.details)) {
    return undefined
  }
  return payment.details.inner.metadata.ticker
}

const hasConversion = (payment: Payment): boolean => {
  if (payment.conversionDetails) return true
  if (!payment.details) return false

  if (PaymentDetails.Spark.instanceOf(payment.details)) {
    return Boolean(payment.details.inner.conversionInfo)
  }
  if (PaymentDetails.Token.instanceOf(payment.details)) {
    return Boolean(payment.details.inner.conversionInfo)
  }

  return false
}

export const mapSelfCustodialTransaction = (payment: Payment): NormalizedTransaction => {
  const currency = mapCurrency(payment.details)
  const tokenDecimals = getTokenDecimals(payment.details)
  const rawAmount = Math.abs(toNumber(payment.amount))
  return {
    id: payment.id,
    amount: toWalletMoneyAmount(
      toDisplayAmount(rawAmount, currency, tokenDecimals),
      currency,
    ),
    direction: mapDirection(payment.paymentType),
    memo: extractMemo(payment),
    lnAddress: extractLnAddress(payment),
    tokenTicker: extractTokenTicker(payment),
    isConversion: hasConversion(payment),
    status: mapStatus(payment.status),
    timestamp: toNumber(payment.timestamp),
    paymentType: mapPaymentMethod(payment.method, payment.details),
    fee: toWalletMoneyAmount(Math.abs(toNumber(payment.fees)), WalletCurrency.Btc),
    sourceAccountType: AccountType.SelfCustodial,
  }
}

export const mapSelfCustodialTransactions = (
  payments: ReadonlyArray<Payment>,
): NormalizedTransaction[] => payments.map(mapSelfCustodialTransaction)
