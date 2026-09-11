import {
  PaymentMethod,
  PaymentType as SdkPaymentType,
} from "@breeztech/breez-sdk-spark-react-native"

import { RailType, TelemetryConversionDirection, TelemetryDirection } from "./contract"

/**
 * SDK vocabulary → contract vocabulary, in one hop (AD-2). There is no stub state, no
 * enrichment pass and no TTL-partial path: `PaymentSucceeded` carries direction, method
 * and status together, so a settlement is classifiable the moment it is observed.
 *
 * These take the SDK's *enums*, never its `Payment` record — AD-1 keeps that type out of
 * every signature under this directory. The producer reads the record and hands over the
 * two fields that matter.
 */

/**
 * The rail, coarse (FR-16, CD-5).
 *
 * An unrecognised method classifies as `unknown` rather than being dropped or guessed
 * (AD-7). `mappers/transaction.ts` masks `PaymentMethod.Unknown` as Lightning, which is
 * fine for a transaction row and wrong for a count: it would inflate a real bucket on a
 * board tile. Dropping instead would leave the rail split short of the settled total.
 * Naming the outcome is the only option that keeps both numbers honest.
 */
export const classifyRail = (method: PaymentMethod): RailType => {
  switch (method) {
    case PaymentMethod.Lightning:
      return RailType.Lightning
    /** Token transfers are USDB moving over Spark — the same rail, a different unit. */
    case PaymentMethod.Spark:
    case PaymentMethod.Token:
      return RailType.Spark
    case PaymentMethod.Deposit:
    case PaymentMethod.Withdraw:
      return RailType.Onchain
    case PaymentMethod.Unknown:
    default:
      return RailType.Unknown
  }
}

/** Direction is always present on a settled payment, so there is no `unknown` here. A
 *  record the SDK cannot place is not a settlement we can count. */
export const classifyDirection = (
  paymentType: SdkPaymentType,
): TelemetryDirection | null => {
  if (paymentType === SdkPaymentType.Send) return TelemetryDirection.Send
  if (paymentType === SdkPaymentType.Receive) return TelemetryDirection.Receive
  return null
}

/**
 * Which way a swap went, from the two ends of the conversion rather than from what the
 * caller asked for. A request is an intention; the settled record is what happened.
 *
 * `null` where both ends are the same kind of asset — a bitcoin-to-bitcoin or
 * token-to-token movement is not a dollar swap, and guessing a direction for it would put
 * a real count in the wrong bucket (FR-19).
 */
export const classifyConversionDirection = (sides: {
  fromIsBitcoin: boolean
  toIsBitcoin: boolean
}): TelemetryConversionDirection | null => {
  if (sides.fromIsBitcoin === sides.toIsBitcoin) return null
  return sides.fromIsBitcoin
    ? TelemetryConversionDirection.BtcToUsd
    : TelemetryConversionDirection.UsdToBtc
}
