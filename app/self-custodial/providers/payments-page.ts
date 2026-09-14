import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { type NormalizedTransaction } from "@app/types/transaction"

import { listPayments } from "../bridge"
import { isKnownPayment, mapSelfCustodialTransactions } from "../mappers/transaction"

/**
 * How many raw SDK payments each request asks for. Everything that pages through the
 * wallet history reads the same page size, so a screen never has to guess how far a
 * cursor advanced.
 */
export const TRANSACTIONS_PER_PAGE = 20

export type PaymentsPage = {
  transactions: NormalizedTransaction[]
  rawCount: number
  hasMore: boolean
}

/**
 * Reads one page of payments starting at `offset` and normalizes it. `rawCount` counts
 * the payments the SDK answered with, not the ones that survived mapping, so a caller
 * can advance its offset past entries that were dropped. A caller that walks the history
 * for one entry rather than showing it can widen the page it reads.
 */
export const fetchAndMapPayments = async (
  sdk: BreezSdkInterface,
  offset: number,
  pageSize: number = TRANSACTIONS_PER_PAGE,
): Promise<PaymentsPage> => {
  const response = await listPayments(sdk, offset, pageSize)
  const transactions = mapSelfCustodialTransactions(
    response.payments.filter(isKnownPayment),
  )
  return {
    transactions,
    rawCount: response.payments.length,
    hasMore: response.payments.length >= pageSize,
  }
}
