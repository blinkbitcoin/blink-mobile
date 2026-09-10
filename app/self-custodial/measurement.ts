import { PaymentStatus, type Payment } from "@breeztech/breez-sdk-spark-react-native"

import {
  captureTelemetryFact,
  classifyConversionDirection,
  classifyDirection,
  classifyRail,
  mintTelemetryEventId,
  reportBoundaryFault,
  TelemetryEvent,
  WalletProvider,
} from "@app/telemetry"
import { ConvertDirection } from "@app/types/payment"

/**
 * Producer scope: where the SDK's settlement record is projected onto the narrow
 * `TelemetryFact` the boundary accepts (AD-1, AD-2).
 *
 * The projection lives **here** rather than inside `app/telemetry/` on purpose. `Payment`
 * carries `amount`, `fees`, `details`, `conversionDetails` and `timestamp` — the last of
 * which §5.6 names as a linkage vector — so the hazard is holding it in producer scope,
 * and the boundary's type is what enforces that it stops here. A reviewer can then
 * enumerate everything capable of leaving the device by reading `app/telemetry/` alone
 * (NFR-P5).
 *
 * It is one hop: `PaymentSucceeded` carries direction, method and status together, so
 * there is no stub state, no enrichment pass and no race to solve.
 */

/**
 * Telemetry is never worth a payment (NFR-R2). Every emitter runs inside this, so a fault
 * in projection or capture is swallowed rather than thrown back at the caller — the SDK
 * settlement listener that counts payments also drives the wallet refresh, and a throw
 * there would cost the user their balance update to save a metric. The fault sink is the
 * boundary's, so nothing is reported from a device required to emit zero (AD-13).
 */
const safely = (what: string, run: () => void): void => {
  try {
    run()
  } catch (err) {
    reportBoundaryFault(what, err)
  }
}

/**
 * A settled self-custodial payment, in either direction (FR-10).
 *
 * Called for **every** SDK-observed settled receive, not only those arriving at the
 * Lightning Address (FR-11): direct Spark transfers and plain BOLT11 invoices are in scope,
 * and an LNURL-derived count would understate receives by however much the wallet is used
 * without its address.
 */
export const logPaymentSettled = (payment: Payment): void =>
  safely("payment_settled", () => {
    /** Settled means `Completed`. The listener already narrows to `PaymentSucceeded`; this is
     *  the second half of the same statement, and cheap. */
    if (payment.status !== PaymentStatus.Completed) return

    /**
     * A conversion's legs settle as ordinary token payments, so without this a swap would be
     * counted twice — once by `conversion_settled` and again as a payment. The swap event is
     * the one that describes what the user did.
     */
    if (payment.conversionDetails) return

    const direction = classifyDirection(payment.paymentType)
    if (!direction) return

    captureTelemetryFact(
      {
        event: TelemetryEvent.PaymentSettled,
        telemetryEventId: mintTelemetryEventId(),
        walletProvider: WalletProvider.Spark,
        direction,
        railType: classifyRail(payment.method),
      },
      payment.id ?? null,
    )
  })

/**
 * A completed dollar↔bitcoin swap (FR-12). Carries the direction and no amount: swap volume
 * is gated on OD-2, which is a policy decision rather than an engineering task (FR-15).
 */
export const logConversionSettled = (params: {
  direction: ConvertDirection
  sdkPaymentId: string | null
}): void =>
  safely("conversion_settled", () => {
    captureTelemetryFact(
      {
        event: TelemetryEvent.ConversionSettled,
        telemetryEventId: mintTelemetryEventId(),
        walletProvider: WalletProvider.Spark,
        conversionDirection: classifyConversionDirection(params.direction),
      },
      params.sdkPaymentId,
    )
  })

/**
 * An Enhanced user successfully onboarding another user (FR-13).
 *
 * Declared but not yet called: the app has no self-custodial referral surface today — the
 * invite flow behind Circles is custodial and needs an authenticated `me`. The contract
 * lives here so the event is specified when that flow is built; until then the board's
 * Enhanced onboarding tile has no client source and should read as unbuilt, not as zero
 * (FR-61).
 */
export const logReferralCompleted = (params: { sdkPaymentId: string | null }): void =>
  safely("referral_completed", () => {
    captureTelemetryFact(
      {
        event: TelemetryEvent.ReferralCompleted,
        telemetryEventId: mintTelemetryEventId(),
        walletProvider: WalletProvider.Spark,
      },
      params.sdkPaymentId,
    )
  })
