import { useCallback, useEffect, useMemo, useRef } from "react"

import {
  GetPaymentRequest,
  ListPaymentsRequest,
  PaymentDetails,
  type BreezSdkInterface,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
import { useHasSparkToken } from "@app/self-custodial/hooks/use-spark-network"
import { addBounded } from "@app/utils/bounded-collections"
import { reportError } from "@app/utils/error-logging"
import { toNumber } from "@app/utils/helper"

import {
  AutoConvertStatus,
  executeAutoConvert,
  findPendingAutoConvert,
  findRecentConversionId,
  listAutoConvertPairings,
  listPendingAutoConverts,
  markAutoConvertPairing,
  pruneExpiredAutoConvertPairings,
  pruneExpiredAutoConverts,
  recordAutoConvertAttempt,
  releaseAutoConvertAttempt,
  removePendingAutoConvert,
  waitForPaymentCompleted,
  type PendingAutoConvert,
  type WaitForPaymentOptions,
} from "../auto-convert"
import { useAutoConvertStatusActions } from "../providers/auto-convert-status"
import { useSelfCustodialWallet } from "../providers/wallet"

/**
 * Drives BTC->USDB auto-convert for Lightning invoices flagged Dollar:
 * wait for payment completion, run convert under a retry+cooldown policy.
 * Outcome surfacing is handled by the receiving screen, not by this hook.
 */

/** Deduplicates concurrent triggers (live event + sync + mount replay). */
const RETRY_COOLDOWN_MS = 30_000

/** Long enough to not race a slow convert; short enough to recover crashes. */
const ORPHAN_TIMEOUT_MS = 2 * 60 * 1000

const MAX_PROCESSED_PAYMENT_IDS = 200
const MAX_IN_FLIGHT_INVOICES = 50

/**
 * The latest receive's turn to convert, from any receive. Each converts and pairs its
 * conversion before the next one's turn, which reads the conversions claimed only then:
 * two receives of one amount converting at once would otherwise each take the first one's
 * conversion for their own, and the second one's sats would never be converted.
 */
let latestConversionTurn: Promise<unknown> = Promise.resolve()

/** Conversions paired with a receive while the app runs: claimed for every later turn at
 *  once, even should the pairing not reach storage. */
const claimedWhileRunning = new Set<string>()
const MAX_CLAIMED_WHILE_RUNNING = 200

const afterEarlierReceivesConvert = <T>(turn: () => Promise<T>): Promise<T> => {
  const thisTurn = latestConversionTurn.then(turn)
  latestConversionTurn = thisTurn.catch(() => undefined)
  return thisTurn
}

type ConvertMoneyAmount = NonNullable<
  ReturnType<typeof usePriceConversion>["convertMoneyAmount"]
>

const extractLightningInvoiceFromPayment = (payment: Payment): string | undefined => {
  if (!payment.details) return undefined
  if (!PaymentDetails.Lightning.instanceOf(payment.details)) return undefined
  return payment.details.inner.invoice
}

const fetchPaymentById = async (
  sdk: BreezSdkInterface,
  paymentId: string,
): Promise<Payment | undefined> => {
  try {
    const response = await sdk.getPayment(GetPaymentRequest.create({ paymentId }))
    return response.payment
  } catch (err) {
    reportError("auto-convert-listener getPayment", err)
    return undefined
  }
}

const convertSatsToUsdCents = (sats: number, convert: ConvertMoneyAmount): number => {
  const usd = convert(
    { amount: sats, currency: WalletCurrency.Btc, currencyCode: WalletCurrency.Btc },
    WalletCurrency.Usd,
  )
  return usd.amount
}

const isRetryableNow = (record: PendingAutoConvert, nowMs: number): boolean => {
  const { lastAttemptAtMs } = record
  if (lastAttemptAtMs === undefined) return true
  const elapsed = nowMs - lastAttemptAtMs
  if (elapsed >= ORPHAN_TIMEOUT_MS) return true
  return elapsed >= RETRY_COOLDOWN_MS
}

type RunAutoConvertParams = {
  sdk: BreezSdkInterface
  record: PendingAutoConvert
  paymentId: string
  satsReceived: number
  isStableBalanceActive: boolean
  convert: ConvertMoneyAmount
  maxAttempts: number
  waitOptions: WaitForPaymentOptions
  amountMatchToleranceBps: number
  onConverting?: (invoice: string) => void
  onSettled?: (invoice: string) => void
  onConverted?: () => void
}

const runAutoConvert = async ({
  sdk,
  record,
  paymentId,
  satsReceived,
  isStableBalanceActive,
  convert,
  maxAttempts,
  waitOptions,
  amountMatchToleranceBps,
  onConverting,
  onSettled,
  onConverted,
}: RunAutoConvertParams): Promise<void> => {
  // Re-read storage so concurrent invocations agree on the cap state instead
  // of each trusting their own (potentially pre-stamp) snapshot of `attempts`.
  const liveRecord = await findPendingAutoConvert(record.paymentRequest)
  const liveAttempts = liveRecord?.attempts ?? record.attempts
  if (liveAttempts >= maxAttempts) {
    await removePendingAutoConvert(record.paymentRequest)
    return
  }

  onConverting?.(record.paymentRequest)
  try {
    const settled = await waitForPaymentCompleted(sdk, paymentId, waitOptions)
    if (!settled) return

    // Stamp the attempt only after the convert had a chance to run — phantom
    // poll-exhaustion failures must not consume the retry budget.
    await recordAutoConvertAttempt(record.paymentRequest, Date.now())

    const usdCentsAmount = convertSatsToUsdCents(satsReceived, convert)
    const outcome = await afterEarlierReceivesConvert(async () => {
      /** Read in its turn: every receive converted before it is paired by then. */
      const { claimedConversionIds } = await buildClaimedConversionIds()
      const converted = await executeAutoConvert(sdk, {
        satsAmount: satsReceived,
        usdCentsAmount,
        isStableBalanceActive,
        recordCreatedAtMs: record.createdAtMs,
        amountMatchToleranceBps,
        claimedConversionIds,
      })
      if (converted.status === AutoConvertStatus.Converted) {
        /** The conversion's own payment, as the bridge names it; looked up in the history
         *  only when it does not, as a payment whose legs are still syncing may not show. */
        const conversionId =
          converted.conversionPaymentId ??
          (await findRecentConversionId(sdk, {
            satsAmount: satsReceived,
            toleranceBps: amountMatchToleranceBps,
            claimedConversionIds,
          }))
        if (conversionId) {
          addBounded(claimedWhileRunning, conversionId, MAX_CLAIMED_WHILE_RUNNING)
          await markAutoConvertPairing({
            receivePaymentId: paymentId,
            conversionPaymentId: conversionId,
            pairedAtMs: Date.now(),
          })
        }
      }
      return converted
    })

    if (outcome.status === AutoConvertStatus.Converted) {
      await removePendingAutoConvert(record.paymentRequest)
      onConverted?.()
      return
    }

    /** A try that only waited behind an earlier conversion sent nothing, so it spends
     *  none of the receive's attempts: launches that each wait anew could otherwise use
     *  them all up and drop the receive unconverted. */
    if (outcome.status === AutoConvertStatus.Deferred) {
      await releaseAutoConvertAttempt(record.paymentRequest)
      return
    }

    // Terminal non-success outcomes drop silently; Failed and
    // SkippedStableBalanceActive fall through so the next trigger retries
    // until the attempt cap (preserves receive-time intent across toggles).
    if (
      outcome.status === AutoConvertStatus.AlreadyConverted ||
      outcome.status === AutoConvertStatus.SkippedBelowMin
    ) {
      await removePendingAutoConvert(record.paymentRequest)
      onConverted?.()
    }
  } finally {
    onSettled?.(record.paymentRequest)
  }
}

const buildClaimedConversionIds = async (): Promise<{
  claimedConversionIds: ReadonlySet<string>
  pairedReceiveIds: ReadonlySet<string>
}> => {
  const pairings = await listAutoConvertPairings()
  const claimedConversionIds = new Set<string>(claimedWhileRunning)
  const pairedReceiveIds = new Set<string>()
  pairings.forEach((p) => {
    claimedConversionIds.add(p.conversionPaymentId)
    pairedReceiveIds.add(p.receivePaymentId)
  })

  return { claimedConversionIds, pairedReceiveIds }
}

const findPaidAmountForInvoice = async (
  sdk: BreezSdkInterface,
  paymentRequest: string,
): Promise<{ paymentId: string; amount: number } | undefined> => {
  try {
    // No "get by invoice" SDK method; scanning the recent page suffices.
    const payments = await sdk.listPayments(
      ListPaymentsRequest.create({ offset: 0, limit: 50 }),
    )
    // Bolt11 invoices are case-insensitive; lowercase both sides so SDK
    // normalization (e.g. case folding) doesn't break the replay match.
    const target = paymentRequest.toLowerCase()
    const match = payments.payments.find(
      (p) => extractLightningInvoiceFromPayment(p)?.toLowerCase() === target,
    )
    if (!match) return undefined
    return { paymentId: match.id, amount: toNumber(match.amount) }
  } catch (err) {
    reportError("auto-convert-listener findPaidAmountForInvoice", err)
    return undefined
  }
}

export const useAutoConvertListener = (): void => {
  const wallet = useSelfCustodialWallet()
  const { sdk, lastReceivedPaymentId, refreshWallets } = wallet
  const { isAnonMode } = useSelfCustodialAccountMode()
  const hasSparkToken = useHasSparkToken()
  // Defaults unknown to not-active so existing records still process.
  const isStableBalanceActive = wallet.isStableBalanceActive ?? false
  const { convertMoneyAmount } = usePriceConversion()
  const {
    autoConvertMaxAttempts,
    autoConvertPollMaxAttempts,
    autoConvertPollIntervalMs,
    autoConvertAmountMatchToleranceBps,
  } = useRemoteConfig()
  const { markConverting, markSettled } = useAutoConvertStatusActions()

  const handleConverted = useCallback(() => {
    refreshWallets().catch((err) => reportError("auto-convert-listener refresh", err))
  }, [refreshWallets])

  const processedPaymentIdsRef = useRef<Set<string>>(new Set())
  const inFlightInvoicesRef = useRef<Set<string>>(new Set())
  const initialReplayDoneRef = useRef(false)

  const waitOptions = useMemo<WaitForPaymentOptions>(
    () => ({
      maxAttempts: autoConvertPollMaxAttempts,
      intervalMs: autoConvertPollIntervalMs,
    }),
    [autoConvertPollMaxAttempts, autoConvertPollIntervalMs],
  )

  const processWithInFlightLock = useCallback(
    async (params: {
      sdk: BreezSdkInterface
      record: PendingAutoConvert
      paymentId: string
      satsReceived: number
      convert: ConvertMoneyAmount
    }): Promise<void> => {
      const { record } = params
      if (inFlightInvoicesRef.current.has(record.paymentRequest)) return
      addBounded(
        inFlightInvoicesRef.current,
        record.paymentRequest,
        MAX_IN_FLIGHT_INVOICES,
      )
      try {
        await runAutoConvert({
          sdk: params.sdk,
          record,
          paymentId: params.paymentId,
          satsReceived: params.satsReceived,
          isStableBalanceActive,
          convert: params.convert,
          maxAttempts: autoConvertMaxAttempts,
          waitOptions,
          amountMatchToleranceBps: autoConvertAmountMatchToleranceBps,
          onConverting: markConverting,
          onSettled: markSettled,
          onConverted: handleConverted,
        })
      } finally {
        inFlightInvoicesRef.current.delete(record.paymentRequest)
      }
    },
    [
      isStableBalanceActive,
      autoConvertMaxAttempts,
      waitOptions,
      autoConvertAmountMatchToleranceBps,
      markConverting,
      markSettled,
      handleConverted,
    ],
  )

  useEffect(() => {
    if (!sdk || !convertMoneyAmount) return
    /** Anon Mode receives stay bitcoin: pending records wait until the mode is off. So
     *  do they on a network with no dollar token, rather than spend their attempts. */
    if (isAnonMode || !hasSparkToken) return
    if (!lastReceivedPaymentId) return
    if (processedPaymentIdsRef.current.has(lastReceivedPaymentId)) return
    addBounded(
      processedPaymentIdsRef.current,
      lastReceivedPaymentId,
      MAX_PROCESSED_PAYMENT_IDS,
    )

    const run = async () => {
      const payment = await fetchPaymentById(sdk, lastReceivedPaymentId)
      if (!payment) return

      const invoice = extractLightningInvoiceFromPayment(payment)
      if (!invoice) return

      const record = await findPendingAutoConvert(invoice)
      if (!record) return
      if (!isRetryableNow(record, Date.now())) return

      const { pairedReceiveIds } = await buildClaimedConversionIds()
      if (pairedReceiveIds.has(lastReceivedPaymentId)) {
        await removePendingAutoConvert(invoice)
        return
      }

      await processWithInFlightLock({
        sdk,
        record,
        paymentId: lastReceivedPaymentId,
        satsReceived: toNumber(payment.amount),
        convert: convertMoneyAmount,
      })
    }

    run().catch((err) => reportError("auto-convert-listener live run", err))
  }, [
    sdk,
    lastReceivedPaymentId,
    convertMoneyAmount,
    isAnonMode,
    hasSparkToken,
    processWithInFlightLock,
  ])

  useEffect(() => {
    if (!sdk || !convertMoneyAmount) return
    /** An Anon interval re-arms the replay, so exit picks up every pending record. */
    if (isAnonMode || !hasSparkToken) {
      initialReplayDoneRef.current = false
      return
    }
    if (initialReplayDoneRef.current) return
    initialReplayDoneRef.current = true

    const replay = async () => {
      const nowMs = Date.now()
      await Promise.all([
        pruneExpiredAutoConverts(nowMs),
        pruneExpiredAutoConvertPairings(nowMs),
      ])
      const records = await listPendingAutoConverts()
      if (records.length === 0) return

      const processRecord = async (record: PendingAutoConvert): Promise<void> => {
        if (!isRetryableNow(record, nowMs)) return

        const paid = await findPaidAmountForInvoice(sdk, record.paymentRequest)
        // Bound the replay loop on busy wallets where the matching payment has
        // aged off the recent listPayments page.
        if (!paid) {
          if (record.attempts + 1 >= autoConvertMaxAttempts) {
            await removePendingAutoConvert(record.paymentRequest)
            return
          }
          await recordAutoConvertAttempt(record.paymentRequest, nowMs)
          return
        }

        const { pairedReceiveIds } = await buildClaimedConversionIds()
        if (pairedReceiveIds.has(paid.paymentId)) {
          await removePendingAutoConvert(record.paymentRequest)
          return
        }

        await processWithInFlightLock({
          sdk,
          record,
          paymentId: paid.paymentId,
          satsReceived: paid.amount,
          convert: convertMoneyAmount,
        })
      }

      await records.reduce<Promise<void>>(
        (previous, record) => previous.then(() => processRecord(record)),
        Promise.resolve(),
      )
    }

    replay().catch((err) => reportError("auto-convert-listener replay", err))
  }, [
    sdk,
    convertMoneyAmount,
    isAnonMode,
    hasSparkToken,
    processWithInFlightLock,
    autoConvertMaxAttempts,
  ])
}
