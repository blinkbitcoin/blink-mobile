import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { TransactionDirection, type NormalizedTransaction } from "@app/types/transaction"
import { normalizeString } from "@app/utils/helper"

import { fetchAndMapPayments, TRANSACTIONS_PER_PAGE } from "./payments-page"

/**
 * How many raw pages one request may read before answering with whatever it found.
 *
 * Matching happens on the client, so a contact with few payments spread across a long
 * history would otherwise walk the whole wallet before the screen could paint. This caps
 * the work per request; the page comes back short with more still to read, and the next
 * scroll resumes from where this one stopped.
 */
const MAX_PAGES_PER_REQUEST = 5

export type ContactPaymentsPage = {
  transactions: NormalizedTransaction[]
  rawOffset: number
  hasMore: boolean
}

/**
 * The SDK cannot filter payments by counterparty, so a contact's history is found by
 * matching the lightning address the mapper already carries on each transaction.
 *
 * Restricted to sends: `lnAddress` comes from `lnurlPayInfo`, which on a receive holds
 * the address the payer resolved, so an unrestricted match would list a user's own
 * incoming payments as payments with this contact.
 */
const matchesContact = (tx: NormalizedTransaction, identifier: string): boolean =>
  tx.direction === TransactionDirection.Send &&
  tx.lnAddress !== undefined &&
  normalizeString(tx.lnAddress) === identifier

/**
 * Reads one page of a contact's payments, resuming from `rawOffset`.
 *
 * A raw page of wallet payments may contain nothing for this contact. Returning that
 * empty page would stall an infinite scroll, because the list would not grow and so would
 * never ask for more. This keeps pulling raw pages until it fills a page, exhausts the
 * history or reaches its page budget, and reports the offset it stopped at.
 */
export const fetchContactPaymentsPage = async (
  sdk: BreezSdkInterface,
  paymentIdentifier: string,
  rawOffset: number,
): Promise<ContactPaymentsPage> => {
  const identifier = normalizeString(paymentIdentifier)
  const transactions: NormalizedTransaction[] = []

  let offset = rawOffset
  let hasMore = true
  let pagesRead = 0

  while (
    hasMore &&
    transactions.length < TRANSACTIONS_PER_PAGE &&
    pagesRead < MAX_PAGES_PER_REQUEST
  ) {
    const page = await fetchAndMapPayments(sdk, offset)
    pagesRead += 1

    if (page.rawCount === 0) {
      hasMore = false
      break
    }

    transactions.push(...page.transactions.filter((tx) => matchesContact(tx, identifier)))
    offset += page.rawCount
    hasMore = page.hasMore
  }

  return { transactions, rawOffset: offset, hasMore }
}
