import {
  PaymentDetails_Tags as PaymentDetailsTags,
  PaymentMethod,
  PaymentStatus,
  PaymentType as SdkPaymentType,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { toNumber } from "@app/utils/helper"
import { toWalletMoneyAmount } from "@app/types/amounts"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction.types"
import { AccountType } from "@app/types/wallet.types"

const mapPaymentMethod = (
  method: PaymentMethod,
  details?: Payment["details"],
): PaymentType => {
  if (details?.tag === PaymentDetailsTags.Token) return PaymentType.Conversion
  if (method === PaymentMethod.Lightning) return PaymentType.Lightning
  if (method === PaymentMethod.Spark) return PaymentType.Spark
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

export const mapSelfCustodialTransaction = (payment: Payment): NormalizedTransaction => {
  const currency = mapCurrency(payment.details)

  return {
    id: payment.id,
    amount: toWalletMoneyAmount(Math.abs(toNumber(payment.amount)), currency),
    direction: mapDirection(payment.paymentType),
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
