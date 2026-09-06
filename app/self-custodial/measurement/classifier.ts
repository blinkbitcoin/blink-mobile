import {
  PaymentMethod,
  PaymentType as SdkPaymentType,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import { ConvertDirection } from "@app/types/payment"

import { RailType, TelemetryConversionDirection, TelemetryDirection } from "./contract"

/**
 * Turns an SDK settlement record into the three coarse rails the contract allows, and
 * nothing finer (FR-16, CD-5).
 *
 * `null` means "do not emit `payment_settled` for this record" rather than "unknown rail".
 * There is no fallback rail on purpose: guessing would put a real count in the wrong
 * bucket, and mislabelling is a correctness defect of the same severity as a privacy leak
 * (FR-19). A record we cannot classify is better absent from the board than wrong on it.
 */
export const classifyRail = (payment: Payment): RailType | null => {
  /**
   * A conversion's legs settle as ordinary token payments, so without this they would be
   * counted twice: once as a swap by `conversion_settled` and again as a payment. The swap
   * event is the one that describes what the user did.
   */
  if (payment.conversionDetails) return null

  switch (payment.method) {
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
      return null
    default:
      return null
  }
}

export const classifyDirection = (payment: Payment): TelemetryDirection | null => {
  if (payment.paymentType === SdkPaymentType.Send) return TelemetryDirection.Send
  if (payment.paymentType === SdkPaymentType.Receive) return TelemetryDirection.Receive
  return null
}

export const classifyConversionDirection = (
  direction: ConvertDirection,
): TelemetryConversionDirection =>
  direction === ConvertDirection.BtcToUsd
    ? TelemetryConversionDirection.BtcToUsd
    : TelemetryConversionDirection.UsdToBtc
