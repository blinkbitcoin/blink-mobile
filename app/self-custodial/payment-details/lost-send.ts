import {
  PaymentDetails,
  PaymentStatus,
  type BreezSdkInterface,
  type Payment,
  type SparkHtlcDetails,
} from "@breeztech/breez-sdk-spark-react-native"

import { type LostSend } from "@app/screens/send-bitcoin-screen/payment-details/index.types"

import { reportError } from "@app/utils/error-logging"
import { sleep } from "@app/utils/sleep"

import { listSentPaymentsSince, syncSelfCustodialWallet } from "../bridge/wallet"
import { SelfCustodialErrorCode } from "../sdk-error"

/**
 * How a send whose outcome the SDK lost is looked for before it is treated as never made.
 *
 * The SDK's own guidance for a payment that throws after dispatch ("Retrying after a
 * failure that leaves the outcome unknown may pay twice … look for the payment before
 * sending it again"). The wallet's history is local, and a send that threw reaches it
 * only once the wallet has caught up with the server, so every look first asks it to,
 * and the looks are spaced out for the payment to land in between.
 *
 * The caller matches by something no other payment shares (the invoice's payment hash),
 * so the window only bounds the work. It opens a day before the attempt's own clock,
 * since the wallet stamps a payment with the server's clock and a phone's can be set
 * well ahead of it, and it is paged through to its end, so a busy wallet cannot push the
 * payment past the first page.
 */
const LOST_SEND_ATTEMPTS = 3
const LOST_SEND_DELAY_MS = 2000
const LOST_SEND_LOOKBACK_SECONDS = 24 * 60 * 60
const LOST_SEND_PAGE_SIZE = 50
/** Far beyond what a wallet sends in the window: hitting it means the pages never got
 *  shorter, and a history that was not read to its end is one that was not read. */
const LOST_SEND_MAX_PAGES = 20

type FindLostSendParams = {
  sdk: BreezSdkInterface
  /** When the attempt was dispatched, in milliseconds. */
  startedAtMs: number
  /** Whether a payment in the history is one this attempt may have made. */
  matches: (payment: Payment) => boolean
}

export type LostSendLookup =
  | { readonly status: "found"; readonly payment: Payment }
  /** The last look read the history to its end and none of it was the payment: the one
   *  answer that makes the send safe to try again. */
  | { readonly status: "not-found" }
  /** The last look could not read the history, or found a send it cannot tell apart from
   *  the attempt, so nothing is known: not the payment, and not its absence. The error
   *  it met is carried for the caller to report. */
  | { readonly status: "unreadable"; readonly error: unknown }

type HistoryScan = {
  readonly matches: Payment[]
  /** Whether the window holds a send the wallet has not described yet. Such a payment
   *  carries nothing to match on, and a Lightning send can sit that way until the
   *  wallet has fetched what it paid, so it may be the attempt itself. */
  readonly hasUndescribedSend: boolean
}

const isUndescribedSend = (payment: Payment): boolean =>
  payment.details === undefined && payment.status !== PaymentStatus.Failed

const isCompleted = (payment: Payment): boolean =>
  payment.status === PaymentStatus.Completed

const isPendingPayment = (payment: Payment): boolean =>
  payment.status === PaymentStatus.Pending

/** A match that is the attempt landing: a failed payment of the invoice is not one. */
const isLanded = (payment: Payment): boolean =>
  isCompleted(payment) || isPendingPayment(payment)

/**
 * One look: the wallet catches up with the server, then its outgoing payments in the
 * window are read page by page, until the caller's match is complete, the pages run
 * short, or the cap is hit. Throws when the history could not be read, except that a
 * page failing after a landed match was made takes nothing away from it: a payment of
 * the invoice exists. A failed match is not one, so the pages after it still count.
 */
const scanHistorySince = async (
  sdk: BreezSdkInterface,
  since: bigint,
  matches: (payment: Payment) => boolean,
): Promise<HistoryScan> => {
  await syncSelfCustodialWallet(sdk)

  const found: Payment[] = []
  let hasUndescribedSend = false
  for (let page = 0; page < LOST_SEND_MAX_PAGES; page += 1) {
    let payments: Payment[]
    try {
      ;({ payments } = await listSentPaymentsSince(sdk, {
        fromTimestamp: since,
        limit: LOST_SEND_PAGE_SIZE,
        offset: page * LOST_SEND_PAGE_SIZE,
      }))
    } catch (err) {
      if (found.some(isLanded)) return { matches: found, hasUndescribedSend }
      throw err
    }

    found.push(...payments.filter(matches))
    if (payments.some(isUndescribedSend)) hasUndescribedSend = true

    const isScanComplete =
      found.some(isCompleted) || payments.length < LOST_SEND_PAGE_SIZE
    if (isScanComplete) return { matches: found, hasUndescribedSend }
  }

  throw new Error(`Lost send lookup ran past ${LOST_SEND_MAX_PAGES} pages without an end`)
}

/**
 * The payment an attempt made in spite of throwing, "not-found" when the last look read
 * the history and showed none, or "unreadable" when it could not. A completed payment
 * outranks a pending one for the same attempt; a failed one is not the attempt landing,
 * so it is passed over.
 *
 * The last look decides, since each one reads the history afresh after the wallet caught
 * up: a look that could not read earlier says nothing about one that did later.
 */
export const findLostSend = async ({
  sdk,
  startedAtMs,
  matches,
}: FindLostSendParams): Promise<LostSendLookup> => {
  const since = BigInt(Math.floor(startedAtMs / 1000) - LOST_SEND_LOOKBACK_SECONDS)
  let lastLook: LostSendLookup = { status: "not-found" }

  for (let attempt = 1; attempt <= LOST_SEND_ATTEMPTS; attempt += 1) {
    try {
      const scan = await scanHistorySince(sdk, since, matches)
      const payment =
        scan.matches.find(isCompleted) ?? scan.matches.find(isPendingPayment)
      if (payment) return { status: "found", payment }
      lastLook = scan.hasUndescribedSend
        ? {
            status: "unreadable",
            error: new Error("Lost send lookup met an undescribed send"),
          }
        : { status: "not-found" }
    } catch (err) {
      reportError("Self-custodial lost send lookup", err)
      lastLook = { status: "unreadable", error: err }
    }

    const isLastAttempt = attempt === LOST_SEND_ATTEMPTS
    if (!isLastAttempt) await sleep(LOST_SEND_DELAY_MS)
  }

  return lastLook
}

/**
 * The HTLC a payment in the wallet's history settled, whichever rail carried it: a
 * Lightning payment's, or a Spark transfer's when the invoice was paid to a Spark wallet
 * directly. Both carry the invoice's payment hash and, once released, its preimage.
 */
export const htlcDetailsOf = (payment: Payment): SparkHtlcDetails | undefined => {
  const details = payment.details
  if (!details) return undefined
  if (PaymentDetails.Lightning.instanceOf(details)) return details.inner.htlcDetails
  if (PaymentDetails.Spark.instanceOf(details)) return details.inner.htlcDetails
  return undefined
}

/** The Spark invoice a payment in the wallet's history paid, bitcoin or token. */
const sparkInvoiceOf = (payment: Payment): string | undefined => {
  const details = payment.details
  if (!details) return undefined
  if (PaymentDetails.Spark.instanceOf(details))
    return details.inner.invoiceDetails?.invoice
  if (PaymentDetails.Token.instanceOf(details))
    return details.inner.invoiceDetails?.invoice
  return undefined
}

/**
 * Whether a payment in the wallet's history is one the lost attempts made: by payment
 * hash or Spark invoice, the one thing the quoted request and the wallet's record of
 * paying it share, and that no other payment does.
 */
export const isPaymentOfLostSend = (
  lost: Pick<LostSend, "paymentHashes" | "sparkInvoices">,
  payment: Payment,
): boolean => {
  const paymentHash = htlcDetailsOf(payment)?.paymentHash
  if (paymentHash !== undefined && lost.paymentHashes.includes(paymentHash)) return true
  const sparkInvoice = sparkInvoiceOf(payment)
  return sparkInvoice !== undefined && (lost.sparkInvoices ?? []).includes(sparkInvoice)
}

/**
 * The failures the SDK raises before it sends anything: the amount, the request or the
 * funds were refused on the way in. Shown at once, since the looks that follow a throw
 * are for a payment that may have been dispatched, and none was.
 */
export const CODES_RAISED_BEFORE_DISPATCH: ReadonlySet<SelfCustodialErrorCode> = new Set([
  SelfCustodialErrorCode.InsufficientFunds,
  SelfCustodialErrorCode.BelowMinimum,
  SelfCustodialErrorCode.InvalidInput,
])
