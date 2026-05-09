import {
  ConversionStatus,
  GetPaymentRequest,
  ListPaymentsRequest,
  PaymentStatus,
  type BreezSdkInterface,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"
import crashlytics from "@react-native-firebase/crashlytics"

import { WalletCurrency } from "@app/graphql/generated"
import {
  ConvertDirection,
  ConvertErrorCode,
  PaymentResultStatus,
  type ConvertParams,
} from "@app/types/payment.types"
import { toNumber } from "@app/utils/helper"

import { createGetConversionQuote } from "../bridge/convert"
import { fetchConversionLimits } from "../bridge/limits"
import { fetchUsdbDecimals } from "../bridge/token-balance"

import { AutoConvertStatus, type AutoConvertOutcome } from "./types"

export type ExecuteAutoConvertParams = {
  satsAmount: number
  usdCentsAmount: number
  /** Skip when Breez's global sweep owns the conversion. */
  isStableBalanceActive: boolean
  /** Lower bound for matching conversions in the payment history. */
  recordCreatedAtMs: number
  /**
   * Basis points of drift allowed when matching a prior conversion by
   * amount. Defaults to {@link DEFAULT_AMOUNT_MATCH_TOLERANCE_BPS}.
   */
  amountMatchToleranceBps?: number
  /** Conversion paymentIds already paired with another receive; excluded from amount-tolerance dedup. */
  claimedConversionIds?: ReadonlySet<string>
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export type WaitForPaymentOptions = {
  maxAttempts: number
  intervalMs: number
}

/**
 * Polls until the payment reports `Completed`. The convert must wait
 * for operator finalization or it fails with `ent: transfer not found`
 * at `finalize_node_signatures`.
 */
export const waitForPaymentCompleted = async (
  sdk: BreezSdkInterface,
  paymentId: string,
  options: WaitForPaymentOptions,
): Promise<boolean> => {
  for (let attempt = 0; attempt < options.maxAttempts; attempt += 1) {
    try {
      const response = await sdk.getPayment(GetPaymentRequest.create({ paymentId }))
      if (response.payment.status === PaymentStatus.Completed) return true
    } catch {
      // getPayment may transiently fail while the SDK catches up to the operator.
    }
    if (attempt < options.maxAttempts - 1) {
      await sleep(options.intervalMs)
    }
  }
  return false
}

export const fetchAutoConvertMinSats = async (
  sdk: BreezSdkInterface,
): Promise<number | undefined> => {
  try {
    const tokenDecimals = await fetchUsdbDecimals(sdk)
    const limits = await fetchConversionLimits(
      sdk,
      ConvertDirection.BtcToUsd,
      tokenDecimals,
    )
    return limits.minFromAmount ?? undefined
  } catch (err) {
    crashlytics().recordError(
      err instanceof Error ? err : new Error(`fetchAutoConvertMinSats: ${err}`),
    )
    return undefined
  }
}

export const DEFAULT_AMOUNT_MATCH_TOLERANCE_BPS = 500 // 5%

/** Absolute floor on the tolerance window so tiny amounts still match. */
const AMOUNT_MATCH_TOLERANCE_FLOOR = 50

const matchesConversionAmount = (
  payment: Payment,
  satsAmount: number,
  toleranceBps: number,
): boolean => {
  const from = payment.conversionDetails?.from
  if (!from) return false
  const fromAmount = toNumber(from.amount)
  const tolerance = Math.max(
    AMOUNT_MATCH_TOLERANCE_FLOOR,
    Math.floor((satsAmount * toleranceBps) / 10_000),
  )
  return Math.abs(fromAmount - satsAmount) <= tolerance
}

/**
 * True when the payment history has a completed conversion matching
 * `satsAmount` after `recordCreatedAtMs`. Covers sweeps, manual
 * Transfers, and previous attempts that settled without bubbling up.
 */
type PriorConversionMatch = {
  satsAmount: number
  recordCreatedAtMs: number
  toleranceBps: number
  claimedConversionIds: ReadonlySet<string>
}

const hasAlreadyConverted = async (
  sdk: BreezSdkInterface,
  match: PriorConversionMatch,
): Promise<boolean> => {
  try {
    const response = await sdk.listPayments(
      ListPaymentsRequest.create({ offset: 0, limit: 50 }),
    )
    return response.payments.some((payment) => {
      const details = payment.conversionDetails
      if (!details || details.status !== ConversionStatus.Completed) return false

      if (match.claimedConversionIds.has(payment.id)) return false

      const paymentMs = Number(payment.timestamp) * 1000
      if (paymentMs < match.recordCreatedAtMs) return false

      return matchesConversionAmount(payment, match.satsAmount, match.toleranceBps)
    })
  } catch {
    return false
  }
}

/** Picks the most recent unclaimed completed conversion within tolerance, for pairing. */
export const findRecentConversionId = async (
  sdk: BreezSdkInterface,
  match: {
    satsAmount: number
    toleranceBps: number
    claimedConversionIds: ReadonlySet<string>
  },
): Promise<string | undefined> => {
  try {
    const response = await sdk.listPayments(
      ListPaymentsRequest.create({ offset: 0, limit: 50 }),
    )
    const candidate = response.payments.find((payment) => {
      const details = payment.conversionDetails
      if (!details || details.status !== ConversionStatus.Completed) return false
      if (match.claimedConversionIds.has(payment.id)) return false
      return matchesConversionAmount(payment, match.satsAmount, match.toleranceBps)
    })
    return candidate?.id
  } catch {
    return undefined
  }
}

const isBelowMinimumError = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  (err as { code?: string }).code === ConvertErrorCode.BelowMinimum

export const executeAutoConvert = async (
  sdk: BreezSdkInterface,
  params: ExecuteAutoConvertParams,
): Promise<AutoConvertOutcome> => {
  if (params.isStableBalanceActive) {
    return { status: AutoConvertStatus.SkippedStableBalanceActive }
  }

  const toleranceBps =
    params.amountMatchToleranceBps ?? DEFAULT_AMOUNT_MATCH_TOLERANCE_BPS
  const alreadyConverted = await hasAlreadyConverted(sdk, {
    satsAmount: params.satsAmount,
    recordCreatedAtMs: params.recordCreatedAtMs,
    toleranceBps,
    claimedConversionIds: params.claimedConversionIds ?? new Set(),
  })
  if (alreadyConverted) {
    return { status: AutoConvertStatus.AlreadyConverted }
  }

  const convertParams: ConvertParams = {
    fromAmount: {
      amount: params.satsAmount,
      currency: WalletCurrency.Btc,
      currencyCode: WalletCurrency.Btc,
    },
    toAmount: {
      amount: params.usdCentsAmount,
      currency: WalletCurrency.Usd,
      currencyCode: WalletCurrency.Usd,
    },
    direction: ConvertDirection.BtcToUsd,
  }

  let quote
  try {
    quote = await createGetConversionQuote(sdk)(convertParams)
  } catch (err) {
    if (isBelowMinimumError(err)) {
      return { status: AutoConvertStatus.SkippedBelowMin }
    }
    return { status: AutoConvertStatus.Failed }
  }
  if (!quote) return { status: AutoConvertStatus.Failed }

  const result = await quote.execute()
  if (result.status === PaymentResultStatus.Success) {
    return { status: AutoConvertStatus.Converted }
  }
  return { status: AutoConvertStatus.Failed }
}
