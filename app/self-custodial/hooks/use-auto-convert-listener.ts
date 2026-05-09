import { useEffect, useMemo, useRef } from "react"

import {
  GetPaymentRequest,
  ListPaymentsRequest,
  PaymentDetails,
  type BreezSdkInterface,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toNumber } from "@app/utils/helper"
import { toastShow } from "@app/utils/toast"

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
import { useSelfCustodialWallet } from "../providers/wallet-provider"

/**
 * Drives BTC->USDB auto-convert for Lightning invoices flagged Dollar:
 * wait for payment completion, run convert under a retry+cooldown
 * policy, surface only the success toast (failures are silent).
 */

/** Deduplicates concurrent triggers (live event + sync + mount replay). */
const RETRY_COOLDOWN_MS = 30_000

/** Long enough to not race a slow convert; short enough to recover crashes. */
const ORPHAN_TIMEOUT_MS = 2 * 60 * 1000

type ConvertMoneyAmount = NonNullable<
  ReturnType<typeof usePriceConversion>["convertMoneyAmount"]
>

type LL = ReturnType<typeof useI18nContext>["LL"]

const reportError = (err: unknown, context: string): void => {
  crashlytics().recordError(err instanceof Error ? err : new Error(`${context}: ${err}`))
}

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
    reportError(err, "auto-convert-listener: getPayment failed")
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

const showConvertedToast = (satsReceived: number, LL: LL): void => {
  toastShow({
    message: (tr) => tr.ReceiveScreen.autoConvertSuccess({ amount: satsReceived }),
    LL,
    type: "success",
  })
}

type RunAutoConvertParams = {
  sdk: BreezSdkInterface
  record: PendingAutoConvert
  paymentId: string
  satsReceived: number
  isStableBalanceActive: boolean
  convert: ConvertMoneyAmount
  LL: LL
  maxAttempts: number
  waitOptions: WaitForPaymentOptions
  amountMatchToleranceBps: number
  claimedConversionIds: ReadonlySet<string>
}

const triggerBackgroundSync = (sdk: BreezSdkInterface): void => {
  syncSelfCustodialWallet(sdk).catch((err) => {
    reportError(err, "auto-convert-listener syncWallet")
  })
}

const runAutoConvert = async ({
  sdk,
  record,
  paymentId,
  satsReceived,
  isStableBalanceActive,
  convert,
  LL,
  maxAttempts,
  waitOptions,
  amountMatchToleranceBps,
  claimedConversionIds,
}: RunAutoConvertParams): Promise<void> => {
  if (record.attempts >= maxAttempts) {
    await removePendingAutoConvert(record.paymentRequest)
    return
  }

  triggerBackgroundSync(sdk)

  const settled = await waitForPaymentCompleted(sdk, paymentId, waitOptions)
  if (!settled) return

  // Stamp the attempt for retry cooldown and orphan detection.
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
    showConvertedToast(satsReceived, LL)
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
    const match = payments.payments.find(
      (p) => extractLightningInvoiceFromPayment(p) === paymentRequest,
    )
    if (!match) return undefined
    return { paymentId: match.id, amount: toNumber(match.amount) }
  } catch (err) {
    reportError(err, "auto-convert-listener: findPaidAmountForInvoice failed")
    return undefined
  }
}

export const useAutoConvertListener = (): void => {
  const wallet = useSelfCustodialWallet()
  const { sdk, lastReceivedPaymentId } = wallet
  // Defaults unknown to not-active so existing records still process.
  const isStableBalanceActive = wallet.isStableBalanceActive ?? false
  const { convertMoneyAmount } = usePriceConversion()
  const { LL } = useI18nContext()
  const {
    autoConvertMaxAttempts,
    autoConvertPollMaxAttempts,
    autoConvertPollIntervalMs,
    autoConvertAmountMatchToleranceBps,
  } = useRemoteConfig()

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

  // Live: reacts when a new payment id arrives while the app is open.
  useEffect(() => {
    if (!sdk || !convertMoneyAmount) return
    if (!lastReceivedPaymentId) return
    if (processedPaymentIdsRef.current.has(lastReceivedPaymentId)) return
    processedPaymentIdsRef.current.add(lastReceivedPaymentId)

    const run = async () => {
      const payment = await fetchPaymentById(sdk, lastReceivedPaymentId)
      if (!payment) return

      const invoice = extractLightningInvoiceFromPayment(payment)
      if (!invoice) return

      const record = await findPendingAutoConvert(invoice)
      if (!record) return

      if (inFlightInvoicesRef.current.has(invoice)) return
      if (!isRetryableNow(record, Date.now())) return

      const { claimedConversionIds, pairedReceiveIds } = await buildClaimedConversionIds()
      if (pairedReceiveIds.has(lastReceivedPaymentId)) {
        await removePendingAutoConvert(invoice)
        return
      }

      inFlightInvoicesRef.current.add(invoice)
      try {
        await runAutoConvert({
          sdk,
          record,
          paymentId: lastReceivedPaymentId,
          satsReceived: toNumber(payment.amount),
          isStableBalanceActive,
          convert: convertMoneyAmount,
          LL,
          maxAttempts: autoConvertMaxAttempts,
          waitOptions,
          amountMatchToleranceBps: autoConvertAmountMatchToleranceBps,
          claimedConversionIds,
        })
      } finally {
        inFlightInvoicesRef.current.delete(invoice)
      }
    }

    run().catch((err) => reportError(err, "auto-convert-listener: live run failed"))
  }, [
    sdk,
    lastReceivedPaymentId,
    isStableBalanceActive,
    convertMoneyAmount,
    LL,
    autoConvertMaxAttempts,
    waitOptions,
    autoConvertAmountMatchToleranceBps,
  ])

  // Replay on mount: handles payments that settled while closed, plus
  // orphans from attempts the previous run abandoned mid-way.
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
        if (inFlightInvoicesRef.current.has(record.paymentRequest)) return
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

        const { claimedConversionIds, pairedReceiveIds } =
          await buildClaimedConversionIds()
        if (pairedReceiveIds.has(paid.paymentId)) {
          await removePendingAutoConvert(record.paymentRequest)
          return
        }

        inFlightInvoicesRef.current.add(record.paymentRequest)
        try {
          await runAutoConvert({
            sdk,
            record,
            paymentId: paid.paymentId,
            satsReceived: paid.amount,
            isStableBalanceActive,
            convert: convertMoneyAmount,
            LL,
            maxAttempts: autoConvertMaxAttempts,
            waitOptions,
            amountMatchToleranceBps: autoConvertAmountMatchToleranceBps,
            claimedConversionIds,
          })
        } finally {
          inFlightInvoicesRef.current.delete(record.paymentRequest)
        }
      }

      await records.reduce<Promise<void>>(
        (previous, record) => previous.then(() => processRecord(record)),
        Promise.resolve(),
      )
    }

    replay().catch((err) => reportError(err, "auto-convert-listener: replay failed"))
  }, [
    sdk,
    convertMoneyAmount,
    isStableBalanceActive,
    LL,
    autoConvertMaxAttempts,
    waitOptions,
    autoConvertAmountMatchToleranceBps,
  ])
}
