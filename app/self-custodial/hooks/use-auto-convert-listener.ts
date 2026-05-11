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
  removePendingAutoConvert,
  waitForPaymentCompleted,
  type PendingAutoConvert,
  type WaitForPaymentOptions,
} from "../auto-convert"
import { syncSelfCustodialWallet } from "../bridge"
import { useAutoConvertStatusActions } from "../providers/auto-convert-status"
import { useSelfCustodialWallet } from "../providers/wallet-provider"

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
  claimedConversionIds: ReadonlySet<string>
  onConverting?: (invoice: string) => void
  onSettled?: (invoice: string) => void
  onConverted?: () => void
}

const triggerBackgroundSync = (sdk: BreezSdkInterface): void => {
  syncSelfCustodialWallet(sdk).catch((err) => {
    reportError("auto-convert-listener syncWallet", err)
  })
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
  claimedConversionIds,
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
    // Run sync in parallel with the bounded poll: by the time
    // `waitForPaymentCompleted` resolves, the SDK has typically materialized
    // the just-received token balance.
    triggerBackgroundSync(sdk)

    const settled = await waitForPaymentCompleted(sdk, paymentId, waitOptions)
    if (!settled) return

    // Stamp the attempt only after the convert had a chance to run — phantom
    // poll-exhaustion failures must not consume the retry budget (Critical #1).
    await recordAutoConvertAttempt(record.paymentRequest, Date.now())

    const usdCentsAmount = convertSatsToUsdCents(satsReceived, convert)
    const outcome = await executeAutoConvert(sdk, {
      satsAmount: satsReceived,
      usdCentsAmount,
      isStableBalanceActive,
      recordCreatedAtMs: record.createdAtMs,
      amountMatchToleranceBps,
      claimedConversionIds,
    })

    if (outcome.status === AutoConvertStatus.Converted) {
      const conversionId = await findRecentConversionId(sdk, {
        satsAmount: satsReceived,
        toleranceBps: amountMatchToleranceBps,
        claimedConversionIds,
      })
      if (conversionId) {
        await markAutoConvertPairing({
          receivePaymentId: paymentId,
          conversionPaymentId: conversionId,
          pairedAtMs: Date.now(),
        })
      }

      await removePendingAutoConvert(record.paymentRequest)
      onConverted?.()
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
  const claimedConversionIds = new Set<string>()
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
      claimedConversionIds: ReadonlySet<string>
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
          claimedConversionIds: params.claimedConversionIds,
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

      const { claimedConversionIds, pairedReceiveIds } = await buildClaimedConversionIds()
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
        claimedConversionIds,
      })
    }

    run().catch((err) => reportError("auto-convert-listener live run", err))
  }, [sdk, lastReceivedPaymentId, convertMoneyAmount, processWithInFlightLock])

  useEffect(() => {
    if (!sdk || !convertMoneyAmount) return
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
        // aged off the recent listPayments page (Critical #6).
        if (!paid) {
          if (record.attempts + 1 >= autoConvertMaxAttempts) {
            await removePendingAutoConvert(record.paymentRequest)
            return
          }
          await recordAutoConvertAttempt(record.paymentRequest, nowMs)
          return
        }

        const { claimedConversionIds, pairedReceiveIds } =
          await buildClaimedConversionIds()
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
          claimedConversionIds,
        })
      }

      await records.reduce<Promise<void>>(
        (previous, record) => previous.then(() => processRecord(record)),
        Promise.resolve(),
      )
    }

    replay().catch((err) => reportError("auto-convert-listener replay", err))
  }, [sdk, convertMoneyAmount, processWithInFlightLock, autoConvertMaxAttempts])
}
