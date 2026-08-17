import { recordAppError } from "@app/utils/error-reporting"
import {
  PaymentDetails,
  PaymentDetails_Tags as PaymentDetailsTags,
  PaymentMethod,
  PaymentStatus,
  PaymentType as SdkPaymentType,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { tokenBaseUnitsToCents } from "@app/utils/amounts"
import { toWalletMoneyAmount } from "@app/types/amounts"
import {
  PaymentType,
  TransactionDirection,
  TransactionStatus,
  type NormalizedTransaction,
} from "@app/types/transaction"
import { AccountType } from "@app/types/wallet"
import { toNumber } from "@app/utils/helper"

import { requireSparkTokenIdentifier } from "../config"
import { recordErrorOnce } from "../logging"

const reportUnhandledEnum = <T>(scope: string, unhandled: unknown, fallback: T): T => {
  recordAppError(
    new Error(`transaction-mapper.${scope}: unhandled SDK value ${String(unhandled)}`),
  )
  return fallback
}

const mapPaymentMethod = (
  method: PaymentMethod,
  details?: Payment["details"],
): PaymentType => {
  if (details?.tag === PaymentDetailsTags.Token) return PaymentType.Conversion
  switch (method) {
    case PaymentMethod.Lightning:
      return PaymentType.Lightning
    case PaymentMethod.Spark:
      return PaymentType.Spark
    case PaymentMethod.Token:
      return PaymentType.Conversion
    case PaymentMethod.Deposit:
    case PaymentMethod.Withdraw:
      return PaymentType.Onchain
    case PaymentMethod.Unknown:
      return reportUnhandledEnum("mapPaymentMethod", "Unknown", PaymentType.Lightning)
    default:
      return reportUnhandledEnum(
        "mapPaymentMethod",
        method satisfies never,
        PaymentType.Lightning,
      )
  }
}

const mapDirection = (paymentType: SdkPaymentType): TransactionDirection => {
  switch (paymentType) {
    case SdkPaymentType.Send:
      return TransactionDirection.Send
    case SdkPaymentType.Receive:
      return TransactionDirection.Receive
    default:
      return reportUnhandledEnum(
        "mapDirection",
        paymentType satisfies never,
        TransactionDirection.Receive,
      )
  }
}

const mapStatus = (status: PaymentStatus): TransactionStatus => {
  if (status === PaymentStatus.Completed) return TransactionStatus.Completed
  if (status === PaymentStatus.Pending) return TransactionStatus.Pending
  return TransactionStatus.Failed
}

export const mapCurrency = (details?: Payment["details"]): WalletCurrency => {
  if (!details) return WalletCurrency.Btc
  switch (details.tag) {
    case PaymentDetailsTags.Token:
      return WalletCurrency.Usd
    case PaymentDetailsTags.Spark:
    case PaymentDetailsTags.Lightning:
    case PaymentDetailsTags.Withdraw:
    case PaymentDetailsTags.Deposit:
      return WalletCurrency.Btc
    default:
      return reportUnhandledEnum(
        "mapCurrency",
        (details as { tag: never }).tag,
        WalletCurrency.Btc,
      )
  }
}

const getTokenDecimals = (details?: Payment["details"]): number => {
  if (!details || !PaymentDetails.Token.instanceOf(details)) return 0
  return details.inner.metadata.decimals
}

const toDisplayAmount = (
  rawAmount: number,
  currency: WalletCurrency,
  tokenDecimals: number,
): number =>
  currency === WalletCurrency.Btc
    ? rawAmount
    : tokenBaseUnitsToCents(rawAmount, tokenDecimals)

export const extractMemo = (payment: Payment): string | undefined => {
  if (!payment.details) return undefined

  if (PaymentDetails.Lightning.instanceOf(payment.details)) {
    /**
     * For an LNURL/Lightning-address send the invoice description carries the destination's
     * own advertised text, while the sender's note travels as the LUD-12 comment and is what
     * the SDK stores in lnurlPayInfo.comment. The comment is the user's own note, so it wins
     * over the destination description for history display, matching custodial behaviour.
     */
    const { lnurlPayInfo, description } = payment.details.inner
    return lnurlPayInfo?.comment ?? description ?? undefined
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

const conversionInfoOf = (payment: Payment) => {
  if (!payment.details) return undefined
  if (PaymentDetails.Spark.instanceOf(payment.details)) {
    return payment.details.inner.conversionInfo
  }
  if (PaymentDetails.Token.instanceOf(payment.details)) {
    return payment.details.inner.conversionInfo
  }
  return undefined
}

export const hasConversion = (payment: Payment): boolean =>
  Boolean(payment.conversionDetails) || Boolean(conversionInfoOf(payment))

/**
 * A token payment for anything other than the configured USDB token has no wallet in
 * this app; every surface (history, balances, CSV export) drops it rather than guessing
 * at units, with a deduped breadcrumb so the gap is visible in crash reporting.
 */
export const isKnownPayment = (payment: Payment): boolean => {
  if (payment.method !== PaymentMethod.Token) return true
  if (!payment.details || !PaymentDetails.Token.instanceOf(payment.details)) return false
  const expectedIdentifier = requireSparkTokenIdentifier()
  const observedIdentifier = payment.details.inner.metadata.identifier
  if (observedIdentifier === expectedIdentifier) return true
  recordErrorOnce(
    `spark-unknown-token-payment:${observedIdentifier}`,
    new Error(
      `Unknown token payment dropped: id=${observedIdentifier} expected=${expectedIdentifier}`,
    ),
  )
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
    fee: toWalletMoneyAmount(
      toDisplayAmount(Math.abs(toNumber(payment.fees)), currency, tokenDecimals),
      currency,
    ),
    sourceAccountType: AccountType.SelfCustodial,
  }
}

export const mapSelfCustodialTransactions = (
  payments: ReadonlyArray<Payment>,
): NormalizedTransaction[] => payments.map(mapSelfCustodialTransaction)
