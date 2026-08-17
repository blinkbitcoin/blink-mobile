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
import { toNumber } from "@app/utils/helper"

import { extractMemo, hasConversion, mapCurrency } from "./transaction"

/**
 * Replicates the backend ledger CSV (services/ledger/csv-wallet-export.ts) so exports
 * from self-custodial accounts open in the same spreadsheets and tools as custodial
 * ones: identical header, LF records with a trailing newline, minimal quoting, and the
 * ledger's column conventions (unsigned credit/debit in minor units with the fee folded
 * into the debit, JS Date#toString timestamps). Ledger-only columns (journalId,
 * usernames, memoFromPayer, ...) stay empty; usd/feeUsd are filled only for USDB rows,
 * where the token amount IS the exact historical dollar value — BTC rows would need a
 * historical price the SDK does not have, and a made-up rate is worse than a blank.
 */
const CSV_HEADER = [
  "id",
  "walletId",
  "type",
  "credit",
  "debit",
  "fee",
  "currency",
  "timestamp",
  "pendingConfirmation",
  "journalId",
  "lnMemo",
  "usd",
  "feeUsd",
  "recipientWalletId",
  "username",
  "memoFromPayer",
  "paymentHash",
  "pubkey",
  "feeKnownInAdvance",
  "address",
  "txHash",
  "displayAmount",
  "displayFee",
  "displayCurrency",
] as const

/**
 * The `type` column vocabulary for payments with no custodial analogue. Descriptive
 * labels spark transfers and conversions by what they are; CustodialCompat maps them to
 * the nearest ledger term (on_us / self_trade) so parsers locked to the custodial value
 * set see no new tokens. Lightning and on-chain rows use the custodial values either way.
 */
export const CsvTypeVocabulary = {
  Descriptive: "descriptive",
  CustodialCompat: "custodial-compat",
} as const
export type CsvTypeVocabulary = (typeof CsvTypeVocabulary)[keyof typeof CsvTypeVocabulary]

export const DEFAULT_CSV_TYPE_VOCABULARY: CsvTypeVocabulary =
  CsvTypeVocabulary.Descriptive

/** csv-writer quotes only when it must: field contains a comma, quote or line break. */
const escapeCsvField = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

const csvType = (
  payment: Payment,
  isSend: boolean,
  vocabulary: CsvTypeVocabulary,
): string => {
  const compat = vocabulary === CsvTypeVocabulary.CustodialCompat
  if (hasConversion(payment)) return compat ? "self_trade" : "conversion"
  switch (payment.details?.tag) {
    case PaymentDetailsTags.Lightning:
      return isSend ? "payment" : "invoice"
    case PaymentDetailsTags.Deposit:
      return "onchain_receipt"
    case PaymentDetailsTags.Withdraw:
      return "onchain_payment"
    case PaymentDetailsTags.Spark:
    case PaymentDetailsTags.Token:
      return compat ? "on_us" : "spark_transfer"
    default:
      break
  }
  /** No details on the payment: type from the coarser method, LN naming as the last
   *  resort to mirror mapPaymentMethod's fallback. */
  switch (payment.method) {
    case PaymentMethod.Deposit:
      return "onchain_receipt"
    case PaymentMethod.Withdraw:
      return "onchain_payment"
    case PaymentMethod.Spark:
    case PaymentMethod.Token:
      return compat ? "on_us" : "spark_transfer"
    default:
      return isSend ? "payment" : "invoice"
  }
}

const extractPaymentHash = (details: Payment["details"]): string | undefined => {
  if (!details) return undefined
  if (PaymentDetails.Lightning.instanceOf(details)) {
    return details.inner.htlcDetails?.paymentHash
  }
  if (PaymentDetails.Spark.instanceOf(details)) {
    return details.inner.htlcDetails?.paymentHash
  }
  return undefined
}

const extractPubkey = (details: Payment["details"]): string | undefined =>
  details && PaymentDetails.Lightning.instanceOf(details)
    ? details.inner.destinationPubkey
    : undefined

const extractTxHash = (details: Payment["details"]): string | undefined => {
  if (!details) return undefined
  if (PaymentDetails.Deposit.instanceOf(details)) return details.inner.txId
  if (PaymentDetails.Withdraw.instanceOf(details)) return details.inner.txId
  if (PaymentDetails.Token.instanceOf(details)) return details.inner.txHash
  return undefined
}

type RowAmounts = {
  credit: string
  debit: string
  fee: string
  usd: string
  feeUsd: string
}

/** Sats stay in bigint end-to-end: a satoshi amount can exceed Number.MAX_SAFE_INTEGER
 *  and the ledger CSV prints exact integers. */
const btcAmounts = (payment: Payment, isSend: boolean): RowAmounts => ({
  credit: isSend ? "0" : String(payment.amount),
  debit: isSend ? String(payment.amount + payment.fees) : "0",
  fee: String(payment.fees),
  usd: "",
  feeUsd: "",
})

/** USDB base units convert to cents exactly like the balance/history mappers do; the
 *  usd/feeUsd columns then follow the ledger's centsAmount/100 stringification. The
 *  sats fee column is 0 because a token payment has no satoshi fee — the fee lives in
 *  feeUsd. */
const usdAmounts = (
  payment: Payment,
  isSend: boolean,
  tokenDecimals: number,
): RowAmounts => {
  const amountCents = tokenBaseUnitsToCents(toNumber(payment.amount), tokenDecimals)
  const feeCents = tokenBaseUnitsToCents(toNumber(payment.fees), tokenDecimals)
  return {
    credit: isSend ? "0" : String(amountCents),
    debit: isSend ? String(amountCents + feeCents) : "0",
    fee: "0",
    usd: String(amountCents / 100),
    feeUsd: String(feeCents / 100),
  }
}

const toCsvRow = (
  payment: Payment,
  identityPubkey: string,
  vocabulary: CsvTypeVocabulary,
): string[] => {
  const isSend = payment.paymentType === SdkPaymentType.Send
  const currency = mapCurrency(payment.details)
  const isUsd = currency === WalletCurrency.Usd
  const tokenDecimals =
    payment.details && PaymentDetails.Token.instanceOf(payment.details)
      ? payment.details.inner.metadata.decimals
      : 0
  const amounts = isUsd
    ? usdAmounts(payment, isSend, tokenDecimals)
    : btcAmounts(payment, isSend)

  return [
    payment.id,
    `${identityPubkey}-${isUsd ? "usd" : "btc"}`,
    csvType(payment, isSend, vocabulary),
    amounts.credit,
    amounts.debit,
    amounts.fee,
    currency,
    String(new Date(toNumber(payment.timestamp) * 1000)),
    payment.status === PaymentStatus.Pending ? "true" : "false",
    "", // journalId — ledger bookkeeping identity, no self-custodial analogue
    extractMemo(payment) ?? "",
    amounts.usd,
    amounts.feeUsd,
    "", // recipientWalletId — always blank in custodial exports too
    "", // username — custodial account identity
    "", // memoFromPayer — the single SDK memo goes to lnMemo
    extractPaymentHash(payment.details) ?? "",
    extractPubkey(payment.details) ?? "",
    "", // feeKnownInAdvance — ledger fee-reserve bookkeeping
    "", // address — the SDK exposes only the txid for on-chain payments
    extractTxHash(payment.details) ?? "",
    "", // displayAmount ┐ no historical display-rate data; usd/feeUsd already
    "", // displayFee    │ carry the exact fiat value for USDB rows
    "", // displayCurrency ┘
  ]
}

export const buildTransactionsCsv = (
  payments: ReadonlyArray<Payment>,
  ctx: { identityPubkey: string; vocabulary?: CsvTypeVocabulary },
): string => {
  /** Empty in, empty out — the hook treats "" as "nothing to share", matching the
   *  custodial empty-export contract. */
  if (payments.length === 0) return ""
  const vocabulary = ctx.vocabulary ?? DEFAULT_CSV_TYPE_VOCABULARY
  const lines = payments.map((payment) =>
    toCsvRow(payment, ctx.identityPubkey, vocabulary).map(escapeCsvField).join(","),
  )
  return [CSV_HEADER.join(","), ...lines].join("\n") + "\n"
}
