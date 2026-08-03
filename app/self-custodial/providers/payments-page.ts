import {
  PaymentDetails,
  PaymentMethod,
  type BreezSdkInterface,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { type NormalizedTransaction } from "@app/types/transaction"

import { listPayments } from "../bridge"
import { requireSparkTokenIdentifier } from "../config"
import { recordErrorOnce } from "../logging"
import { mapSelfCustodialTransactions } from "../mappers/transaction"

/**
 * How many raw SDK payments each request asks for. Everything that pages through the
 * wallet history reads the same page size, so a screen never has to guess how far a
 * cursor advanced.
 */
export const TRANSACTIONS_PER_PAGE = 20

const isKnownPayment = (payment: Payment): boolean => {
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

export type PaymentsPage = {
  transactions: NormalizedTransaction[]
  rawCount: number
  hasMore: boolean
}

/**
 * Reads one page of payments starting at `offset` and normalizes it. `rawCount` counts
 * the payments the SDK answered with, not the ones that survived mapping, so a caller
 * can advance its offset past entries that were dropped.
 */
export const fetchAndMapPayments = async (
  sdk: BreezSdkInterface,
  offset: number,
): Promise<PaymentsPage> => {
  const response = await listPayments(sdk, offset, TRANSACTIONS_PER_PAGE)
  const transactions = mapSelfCustodialTransactions(
    response.payments.filter(isKnownPayment),
  )
  return {
    transactions,
    rawCount: response.payments.length,
    hasMore: response.payments.length >= TRANSACTIONS_PER_PAGE,
  }
}
