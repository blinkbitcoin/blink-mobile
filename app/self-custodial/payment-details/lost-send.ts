import {
  ConversionInfo,
  ConversionPurpose,
  ConversionStatus,
  PaymentDetails,
  PaymentStatus,
  type BreezSdkInterface,
  type Payment,
  type SparkHtlcDetails,
} from "@breeztech/breez-sdk-spark-react-native"

import { reportError } from "@app/utils/error-logging"
import { sleep } from "@app/utils/sleep"
import { withTimeout } from "@app/utils/with-timeout"

import {
  getPaymentById,
  listReceivedPaymentsOldestFirst,
  listReceivedPaymentsSince,
  listSentPaymentsSince,
  newestSentPaymentTimestamp,
  syncSelfCustodialWallet,
  type PaymentsPage,
} from "../bridge/wallet"
import { conversionInfoOf } from "../mappers/transaction"
import { SelfCustodialErrorCode } from "../sdk-error"

import { type LostSend } from "./lost-attempts"

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
 * so the window only bounds the work. The wallet stamps a payment with the server's
 * clock, and a phone's can be set well ahead of it or behind it, so the window opens a
 * day before the earlier of the attempt's own clock and the wallet's (the newest send it
 * held as the attempt was lost). It is paged through to its end, so a busy wallet cannot
 * push the payment past the first page.
 */
const LOST_SEND_ATTEMPTS = 3
const LOST_SEND_DELAY_MS = 2000
/**
 * How long one look may spend inside the SDK before it is abandoned. Without it the lookup
 * is bounded in attempts but not in time: the SDK calls are awaited with nothing to stop
 * them, so one that never comes back leaves the whole lookup pending and the send with no
 * outcome at all — the one answer worse than "unreadable". It is not hypothetical here,
 * because a sync waits for an exit-chain collection pass (`collect_exit_chains`).
 * Three looks and two waits put the whole lookup under a minute.
 *
 * The wait is all it bounds. The SDK call it gave up on is left running, because
 * cancelling a user sync wedges the SDK's sync coordinator for as long as the wallet
 * stays connected (see `syncSelfCustodialWallet`). A later look's sync does not join that
 * one: the coordinator drains its waiter batch before running the sync and notifies only
 * that batch, so a caller arriving afterwards is served by the next pass of the loop
 * (`sdk/sync_coordinator.rs` @0.23.1, unchanged at 0.27.1). What that leaves behind is a
 * look whose own work carries on after nothing is waiting for it, which is what
 * `isExpired` is for.
 */
const LOST_SEND_ATTEMPT_TIMEOUT_MS = 15_000
const LOST_SEND_LOOKBACK_SECONDS = 24 * 60 * 60
const LOST_SEND_PAGE_SIZE = 50
/** Far beyond what a wallet sends in the window: hitting it means the pages never got
 *  shorter, and a history that was not read to its end is one that was not read. */
const LOST_SEND_MAX_PAGES = 20

type FindLostSendParams = {
  sdk: BreezSdkInterface
  /** When the attempt was dispatched, in milliseconds. */
  startedAtMs: number
  /** The wallet's own clock as the attempt was lost: see `LostSend.walletClockSec`. */
  walletClockSec: number
  /** Whether a payment in the history is one this attempt may have made. */
  matches: (payment: Payment) => boolean
}

export type LostSendLookup =
  | {
      readonly status: "found"
      readonly payment: Payment
      /** Matches that ended failed, each the end of an attempt: for telemetry only, since
       *  none of them is the attempt landing. */
      readonly failed: ReadonlyArray<Payment>
    }
  /** The last look read the history to its end and none of it was the payment: the one
   *  answer that makes the send safe to try again. */
  | { readonly status: "not-found"; readonly failed: ReadonlyArray<Payment> }
  /** The last look could not read the history, or found a send it cannot tell apart from
   *  the attempt, so nothing is known: not the payment, and not its absence. The error
   *  it met is carried for the caller to report. */
  | { readonly status: "unreadable"; readonly error: unknown }

type HistoryScan = {
  matches: Payment[]
  /** Whether the window holds a send the wallet has not described yet. Such a payment
   *  carries nothing to match on, and a Lightning send can sit that way until the
   *  wallet has fetched what it paid, so it may be the attempt itself. */
  hasUndescribedSend: boolean
  /** Set when the wallet could not catch up with the server first. The local history
   *  can still show the payment, but not that it is absent. */
  syncFailure?: { readonly error: unknown }
}

/**
 * A send the wallet records without details. Besides a Lightning send it has not fetched
 * yet, this is how the SDK (0.27) records a Lightning send that committed funds to the SSP
 * but threw before the SSP was asked to pay: the swap transfer, Pending, with no invoice
 * and no hash. The SDK finishes that send on a later sync (`resume_pending_sends` in
 * `sdk/lightning_sender.rs`), so its payment can land after a look that found nothing by
 * hash. Treating such a send as one that may be the attempt, so the look cannot answer
 * "not-found", is what keeps a retry from paying again meanwhile: narrowing it reopens that.
 */
const isUndescribedSend = (payment: Payment): boolean =>
  payment.details === undefined && payment.status !== PaymentStatus.Failed

const isCompleted = (payment: Payment): boolean =>
  payment.status === PaymentStatus.Completed

const isPendingPayment = (payment: Payment): boolean =>
  payment.status === PaymentStatus.Pending

const isFailedPayment = (payment: Payment): boolean =>
  payment.status === PaymentStatus.Failed

/**
 * The payments a look reads, page by page, and the ones among them that may be the
 * attempt with nothing to match it by: while one is in the window, the look cannot say
 * the attempt is absent.
 */
type HistoryKind = {
  listPage: (
    sdk: BreezSdkInterface,
    page: PaymentsPage,
  ) => ReturnType<typeof listSentPaymentsSince>
  isUndescribed: (payment: Payment) => boolean
}

const SENT_PAYMENTS: HistoryKind = {
  listPage: listSentPaymentsSince,
  isUndescribed: isUndescribedSend,
}

/** What a conversion delivered is matched whether or not the wallet has labeled it as a
 *  conversion's yet, so nothing received stands in for one unmatched. */
const RECEIVED_PAYMENTS: HistoryKind = {
  listPage: listReceivedPaymentsOldestFirst,
  isUndescribed: () => false,
}

/**
 * One look: the wallet catches up with the server, then its payments of the kind looked
 * for in the window are read page by page, until the pages run short or the cap is hit. A completed
 * match does not end it: an older attempt's failed payment may sit on a later page, and
 * that attempt reports its end only once it is seen. Throws when the history could not
 * be read, except that a page failing, or the cap, after a landed match was made takes
 * nothing away from it: a payment of the invoice exists. A failed match is not one, so
 * the pages after it still count.
 */
type ScanHistoryParams = {
  sdk: BreezSdkInterface
  since: bigint
  matches: (payment: Payment) => boolean
  kind: HistoryKind
  /** Whether a payment is past what the look needs to read: once a page read oldest
   *  first reaches one, every page after it is later still. */
  isPastLook?: (payment: Payment) => boolean
  /** Filled as the pages come in rather than returned at the end, so what a look already
   *  saw outlives the look itself. A page that fails, a history with no end, and a look
   *  abandoned at its deadline all leave the caller whatever the pages before showed. */
  into: HistoryScan
  /** Whether the look that owns this scan is already over. The SDK calls cannot be
   *  cancelled, so an abandoned look keeps running inside them and would come back long
   *  afterwards to read a history nobody is waiting for — a burst of paging at exactly
   *  the moment the wallet is busy catching up. Checked between awaits instead. */
  isExpired: () => boolean
}

const scanHistorySince = async ({
  sdk,
  since,
  matches,
  kind,
  isPastLook,
  into,
  isExpired,
}: ScanHistoryParams): Promise<void> => {
  /**
   * The sync also waits for exit-chain collection, and fails when that does, while the
   * history it would have refreshed may already hold the payment. So a failed sync does
   * not end the look; it only rules out "not-found".
   */
  try {
    await syncSelfCustodialWallet(sdk)
  } catch (err) {
    reportError("Self-custodial lost send lookup", err)
    into.syncFailure = { error: err }
  }
  if (isExpired()) return

  for (let page = 0; page < LOST_SEND_MAX_PAGES; page += 1) {
    const { payments } = await kind.listPage(sdk, {
      fromTimestamp: since,
      limit: LOST_SEND_PAGE_SIZE,
      offset: page * LOST_SEND_PAGE_SIZE,
    })

    /** Read up to where the look ends only: a payment past it, on the page that reaches
     *  it, is no more what is looked for than one on a later page. */
    const withinLook = payments.filter((payment) => !isPastLook?.(payment))
    into.matches.push(...withinLook.filter(matches))
    if (withinLook.some(kind.isUndescribed)) into.hasUndescribedSend = true

    const isLastPage = payments.length < LOST_SEND_PAGE_SIZE
    const isPastWhatIsLookedFor = withinLook.length < payments.length
    const isLookOver = isLastPage || isPastWhatIsLookedFor || isExpired()
    if (isLookOver) return
  }

  throw new Error(`Lost send lookup ran past ${LOST_SEND_MAX_PAGES} pages without an end`)
}

/** What a look that showed no payment of the attempt is able to say. */
const withoutPayment = (
  { syncFailure, hasUndescribedSend }: HistoryScan,
  failed: ReadonlyArray<Payment>,
): LostSendLookup => {
  if (syncFailure) return { status: "unreadable", error: syncFailure.error }
  if (hasUndescribedSend) {
    return {
      status: "unreadable",
      error: new Error("Lost send lookup met an undescribed send"),
    }
  }
  return { status: "not-found", failed }
}

/**
 * The payment an attempt made in spite of throwing, "not-found" when the last look read
 * the history and showed none, or "unreadable" when it could not. A completed payment
 * outranks a pending one for the same attempt; a failed one is not the attempt landing,
 * so it is passed over.
 *
 * The last look decides, since each one reads the history afresh after the wallet caught
 * up: a look that could not read earlier says nothing about one that did later.
 *
 * Every look is bounded in time as well, so a wallet that never answers ends the lookup
 * rather than suspending it: an abandoned look is one that could not read the history,
 * which is "unreadable" and never "not-found", so it can still never make a send look
 * safe to repeat.
 */
export const findLostSend = ({
  sdk,
  startedAtMs,
  walletClockSec,
  matches,
}: FindLostSendParams): Promise<LostSendLookup> => {
  const earliestSec = Math.min(Math.floor(startedAtMs / 1000), walletClockSec)
  const since = BigInt(Math.max(0, earliestSec - LOST_SEND_LOOKBACK_SECONDS))
  return lookForPayment({ sdk, since, matches, kind: SENT_PAYMENTS })
}

type LookForPaymentParams = Pick<
  ScanHistoryParams,
  "sdk" | "since" | "matches" | "kind" | "isPastLook"
>

/** The looks themselves, over the payments of one kind made since `since`. */
const lookForPayment = async ({
  sdk,
  since,
  matches,
  kind,
  isPastLook,
}: LookForPaymentParams): Promise<LostSendLookup> => {
  let lastLook: LostSendLookup = { status: "not-found", failed: [] }

  for (let attempt = 1; attempt <= LOST_SEND_ATTEMPTS; attempt += 1) {
    const scan: HistoryScan = { matches: [], hasUndescribedSend: false }
    /** Set once this look has its answer, so the work still running inside it stops at
     *  its next await rather than paging a history nobody will read. */
    let isOver = false
    /** A payment of the invoice that the pages already showed is evidence, and nothing
     *  afterwards unshows it: not a page that fails, not a history without an end, and
     *  not the look running out of time. Read before the failure is reported, so the one
     *  thing a look is for is never lost to the way the look ended. */
    const landed = () =>
      scan.matches.find(isCompleted) ?? scan.matches.find(isPendingPayment)
    try {
      await withTimeout(
        scanHistorySince({
          sdk,
          since,
          matches,
          kind,
          isPastLook,
          into: scan,
          isExpired: () => isOver,
        }),
        LOST_SEND_ATTEMPT_TIMEOUT_MS,
        "Self-custodial lost send lookup",
      )
      const payment = landed()
      const failed = scan.matches.filter(isFailedPayment)
      if (payment) return { status: "found", payment, failed }
      lastLook = withoutPayment(scan, failed)
    } catch (err) {
      const payment = landed()
      /** The failed ones are only the ones this look reached: telemetry a later look can
       *  still complete, where the payment itself cannot wait. */
      if (payment)
        return { status: "found", payment, failed: scan.matches.filter(isFailedPayment) }
      reportError("Self-custodial lost send lookup", err)
      lastLook = { status: "unreadable", error: err }
    } finally {
      isOver = true
    }

    const isLastAttempt = attempt === LOST_SEND_ATTEMPTS
    if (!isLastAttempt) await sleep(LOST_SEND_DELAY_MS)
  }

  return lastLook
}

/**
 * The payment an attempt made under `key`: the SDK records a keyed send with the key as
 * its payment id, so it is asked for by that id once the wallet has caught up with the
 * server. Exact, with no window: nothing a clock says, the phone's or the server's, can
 * leave it out. Looked for as `findLostSend` looks: a few times, spaced out, each look
 * bounded in time, and a wallet that could not catch up can show the payment but never
 * its absence. A failed payment under the key is not the attempt landing; it is passed
 * back for telemetry.
 */
export const findPaymentUnderKey = async ({
  sdk,
  key,
}: {
  sdk: BreezSdkInterface
  key: string
}): Promise<LostSendLookup> => {
  let lastLook: LostSendLookup = { status: "not-found", failed: [] }

  for (let attempt = 1; attempt <= LOST_SEND_ATTEMPTS; attempt += 1) {
    try {
      lastLook = await withTimeout(
        lookUnderKey(sdk, key),
        LOST_SEND_ATTEMPT_TIMEOUT_MS,
        "Self-custodial lost send lookup",
      )
    } catch (err) {
      reportError("Self-custodial lost send lookup", err)
      lastLook = { status: "unreadable", error: err }
    }
    if (lastLook.status === "found") return lastLook

    const isLastAttempt = attempt === LOST_SEND_ATTEMPTS
    if (!isLastAttempt) await sleep(LOST_SEND_DELAY_MS)
  }

  return lastLook
}

const lookUnderKey = async (
  sdk: BreezSdkInterface,
  key: string,
): Promise<LostSendLookup> => {
  let syncFailure: { error: unknown } | undefined
  try {
    await syncSelfCustodialWallet(sdk)
  } catch (err) {
    reportError("Self-custodial lost send lookup", err)
    syncFailure = { error: err }
  }

  const payment = await getPaymentById(sdk, key.toLowerCase())
  const isFound =
    payment !== undefined && (isCompleted(payment) || isPendingPayment(payment))
  if (isFound) return { status: "found", payment, failed: [] }
  if (syncFailure) return { status: "unreadable", error: syncFailure.error }
  const isFailed = payment !== undefined && isFailedPayment(payment)
  return { status: "not-found", failed: isFailed ? [payment] : [] }
}

/**
 * The wallet's own clock for an attempt just lost: when the newest send it holds was
 * made, by the server's clock. 0, so the look reaches back to the start of the history,
 * when it holds none, cannot be read, or does not answer in time: a narrower window could
 * leave the payment out, and a read that never answers would hold the send pending with
 * the attempt not yet recorded.
 */
export const readWalletClockSec = async (sdk: BreezSdkInterface): Promise<number> => {
  try {
    const newest = await withTimeout(
      newestSentPaymentTimestamp(sdk),
      LOST_SEND_ATTEMPT_TIMEOUT_MS,
      "Wallet clock read",
    )
    return newest === undefined ? 0 : Number(newest)
  } catch (err) {
    reportError("Self-custodial wallet clock", err)
    return 0
  }
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
export const sparkInvoiceOf = (payment: Payment): string | undefined => {
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
  const isLostHash = paymentHash !== undefined && lost.paymentHashes.includes(paymentHash)
  if (isLostHash) return true
  const sparkInvoice = sparkInvoiceOf(payment)
  return sparkInvoice !== undefined && lost.sparkInvoices.includes(sparkInvoice)
}

/**
 * Where the wallet's received payments stood as a conversion went out, which is what is
 * told apart from what the conversion delivers: the time the look reads from (unix
 * seconds), and every payment received since then that the mark read. The time is a day
 * before the earlier of the newest payment received and the phone's own clock, so a phone
 * set ahead, or a payment stamped ahead (a token payment carries its sender's clock), does
 * not on its own put it after the delivery, and each payment in that day is known, so
 * none is taken for it. When the wallet received more in that day than a page holds, the
 * time is the oldest one read instead: nothing the mark did not read is taken for
 * unknown. A wallet that received nothing is read from its start, with nothing to tell
 * apart, rather than from a phone clock that may be ahead.
 */
export type ReceivedHistoryMark = {
  walletClockSec: number
  knownPaymentIds: ReadonlyArray<string>
}

/**
 * Reads where the wallet's received payments stand, once the wallet has caught up: a
 * payment sent to it that it has not taken in yet (one sent while it was offline) would be
 * missing from the mark, and could turn up in a later look as what the conversion
 * delivered. Caught up, every payment received since the mark that the mark does not know
 * came in after it, which is what tells a delivery apart from what came before. Throws when
 * the wallet cannot catch up, or the payments cannot be read, or not in time: a conversion
 * that cannot be told apart from what came before must not go out, since nothing could
 * find it again should its outcome be lost.
 */
export const markReceivedHistory = async (
  sdk: BreezSdkInterface,
  nowMs: number = Date.now(),
): Promise<ReceivedHistoryMark> => {
  await withTimeout(
    syncSelfCustodialWallet(sdk),
    LOST_SEND_ATTEMPT_TIMEOUT_MS,
    "Received history mark sync",
  )
  const { payments } = await withTimeout(
    listReceivedPaymentsSince(sdk, {
      fromTimestamp: 0n,
      limit: LOST_SEND_PAGE_SIZE,
      offset: 0,
    }),
    LOST_SEND_ATTEMPT_TIMEOUT_MS,
    "Received history mark",
  )
  if (payments.length === 0) return { walletClockSec: 0, knownPaymentIds: [] }
  const nowSec = Math.floor(nowMs / 1000)
  const newestSec = Number(payments[0].timestamp)
  const dayBefore = Math.max(0, Math.min(newestSec, nowSec) - LOST_SEND_LOOKBACK_SECONDS)
  const isPageFull = payments.length === LOST_SEND_PAGE_SIZE
  const oldestRead = isPageFull ? Number(payments[payments.length - 1].timestamp) : 0
  const walletClockSec = Math.max(dayBefore, oldestRead)
  const known = payments.filter((payment) => Number(payment.timestamp) >= walletClockSec)
  return { walletClockSec, knownPaymentIds: known.map((payment) => payment.id) }
}

/**
 * What a conversion was quoted to deliver: dollars, which the wallet records as a payment
 * of that token (`tokenIdentifier`), or bitcoin, a Spark payment, and about how much, in
 * that asset's base units; what it was quoted to pay in (`amountIn`, in the base units of
 * the asset it converts from; absent from attempts stored before it was recorded); and
 * whether auto-convert made it, which tells whose it is to settle once found.
 */
export type ExpectedDelivery = {
  tokenIdentifier?: string
  amount: number
  amountIn?: number
  isAutomatic: boolean
}

/** How far an amount can be from the one a quote named and still be it: the quote's
 *  slippage, and some. */
const AMOUNT_TOLERANCE_BPS = 100

/** How far above the quote a delivery can come in and still be it: the pool's price can
 *  move in the user's favour between the quote and the swap, with no cap but this one. */
const DELIVERY_SURPLUS_BPS = 1000

/** Whether an amount is about the one a quote named, either way. */
export const isAboutAmount = (amount: number, quoted: number): boolean =>
  Math.abs(amount - quoted) <= (quoted * AMOUNT_TOLERANCE_BPS) / 10_000

/** Whether a delivered amount is what a quote named: not much below it, as slippage
 *  allows, and up to a better price above it. */
export const isAboutDelivered = (amount: number, quoted: number): boolean => {
  const isAboveFloor = amount >= quoted - (quoted * AMOUNT_TOLERANCE_BPS) / 10_000
  const isBelowCeiling = amount <= quoted + (quoted * DELIVERY_SURPLUS_BPS) / 10_000
  return isAboveFloor && isBelowCeiling
}

const isDelivering = (status: ConversionStatus): boolean =>
  status === ConversionStatus.Completed || status === ConversionStatus.Pending

/**
 * Whether a payment in the wallet's history is what a conversion this app made delivered:
 * one that paid the wallet's own invoice, and delivered or is still delivering. The SDK
 * makes such a conversion in the wallet and never pays the invoice, so the payment the
 * swap delivers is all it leaves in the history. The Stable Balance's own conversions,
 * those paying someone else, and the refund of one that failed (a leg of it as well) are
 * none of these.
 */
const isDeliveryOfOwnConversion = (payment: Payment): boolean => {
  const info = conversionInfoOf(payment)
  if (!info || !ConversionInfo.Amm.instanceOf(info)) return false
  const { purpose } = info.inner
  const isOwn =
    purpose !== undefined && ConversionPurpose.SelfTransfer.instanceOf(purpose)
  const status = payment.conversionDetails?.status ?? info.inner.status
  return isOwn && isDelivering(status)
}

/** Whether the wallet records a payment the way a delivery of that asset comes in. */
const isRecordedAs = (
  payment: Payment,
  { tokenIdentifier }: ExpectedDelivery,
): boolean => {
  const { details } = payment
  if (!details) return false
  if (tokenIdentifier === undefined) return PaymentDetails.Spark.instanceOf(details)
  const isToken = PaymentDetails.Token.instanceOf(details)
  return isToken && details.inner.metadata.identifier === tokenIdentifier
}

/** What a conversion's delivery paid in, once the wallet has filled in its legs. */
export const paidInOf = (payment: Payment): number | undefined => {
  const paidIn = payment.conversionDetails?.conversions?.[0]?.from.amount
  return paidIn === undefined ? undefined : Number(paidIn)
}

/**
 * Whether a payment delivers what an attempt was quoted to: its asset, about as much, and,
 * once both are known, for about what the attempt was quoted to pay in. A delivery that
 * paid in another amount is another conversion's, whatever it delivered.
 */
export const isDeliveryAsExpected = (payment: Payment, delivery: ExpectedDelivery) => {
  const paidIn = paidInOf(payment)
  const isPaidInAsQuoted =
    paidIn === undefined ||
    delivery.amountIn === undefined ||
    isAboutAmount(paidIn, delivery.amountIn)
  return (
    isRecordedAs(payment, delivery) &&
    isAboutDelivered(Number(payment.amount), delivery.amount) &&
    isPaidInAsQuoted
  )
}

/**
 * Whether a payment may be what a conversion delivered before the wallet says so: received
 * with no conversion recorded on it, as the asset a lost conversion was quoted to deliver,
 * and about as much. The SDK records a delivery as its conversion's leg once its own call
 * to the pool answers; one whose answer was lost is recorded so only later, once the SDK
 * finds that the swap ran.
 */
const isUnlabeledDelivery = (
  payment: Payment,
  expectedDeliveries: ReadonlyArray<ExpectedDelivery>,
): boolean =>
  conversionInfoOf(payment) === undefined &&
  expectedDeliveries.some((delivery) => isDeliveryAsExpected(payment, delivery))

/** A lost conversion as it is looked for: where the received payments stood as it went
 *  out, what each of its attempts was quoted to deliver, and when the latest went out. */
export type LostConversionLook = ReceivedHistoryMark & {
  expectedDeliveries: ReadonlyArray<ExpectedDelivery>
  lastAttemptAtMs: number
}

/** How far past a lost conversion's latest attempt its delivery is looked for: a day, far
 *  past the minutes a swap takes to deliver, so a phone clock behind the server's by up
 *  to a day still reaches it, and a busy wallet's later receives are never read. */
const LOST_CONVERSION_LOOK_AHEAD_SECONDS = LOST_SEND_LOOKBACK_SECONDS

/**
 * Whether a payment in the wallet's history is what a conversion lost after `lost` was
 * marked delivered: received since the mark, none of the payments the mark already knew,
 * and an own conversion's delivery, or one not labeled as such yet. The mark is taken
 * once the wallet has caught up (`markReceivedHistory`), so a payment it does not know
 * came in after it, and an older one revealed by a later catch-up is already known.
 */
export const isPaymentOfLostConversion = (
  lost: LostConversionLook,
  payment: Payment,
): boolean => {
  const isSinceMark = Number(payment.timestamp) >= lost.walletClockSec
  const isKnown = lost.knownPaymentIds.includes(payment.id)
  const isDelivery =
    isDeliveryOfOwnConversion(payment) ||
    isUnlabeledDelivery(payment, lost.expectedDeliveries)
  return isSinceMark && !isKnown && isDelivery
}

/**
 * What a conversion lost after `lost` was marked delivered, looked for as `findLostSend`
 * looks for a send: from the mark's time, oldest first, up to a day past its latest
 * attempt.
 */
export const findLostConversion = ({
  sdk,
  lost,
}: {
  sdk: BreezSdkInterface
  lost: LostConversionLook
}): Promise<LostSendLookup> => {
  const lookUntilSec =
    Math.floor(lost.lastAttemptAtMs / 1000) + LOST_CONVERSION_LOOK_AHEAD_SECONDS
  return lookForPayment({
    sdk,
    since: BigInt(lost.walletClockSec),
    matches: (payment) => isPaymentOfLostConversion(lost, payment),
    kind: RECEIVED_PAYMENTS,
    isPastLook: (payment) => Number(payment.timestamp) > lookUntilSec,
  })
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
