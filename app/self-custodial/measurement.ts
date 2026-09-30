import {
  ConversionStatus,
  PaymentStatus,
  type ConversionDetails,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

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

/**
 * Producer scope: where the SDK's settlement record is projected onto the narrow
 * `TelemetryFact` the boundary accepts.
 *
 * The projection lives **here** rather than inside `app/telemetry/` on purpose. `Payment`
 * carries `amount`, `fees`, `details`, `conversionDetails` and `timestamp` — the last of
 * which is itself a way to link events — so the hazard is holding it in producer scope,
 * and the boundary's type is what enforces that it stops here. A reviewer can then
 * enumerate everything capable of leaving the device by reading `app/telemetry/` alone.
 *
 * It is one hop: `PaymentSucceeded` carries direction, method and status together, so
 * there is no stub state, no enrichment pass and no race to solve.
 */

/**
 * Telemetry is never worth a payment. Every emitter runs inside this, so a fault
 * in projection or capture is swallowed rather than thrown back at the caller — the SDK
 * settlement listener that counts payments also drives the wallet refresh, and a throw
 * there would cost the user their balance update to save a metric. The fault sink is the
 * boundary's, so nothing is reported from a device required to emit zero.
 */
const safely = (what: string, run: () => void): void => {
  try {
    run()
  } catch (err) {
    reportBoundaryFault(what, err)
  }
}

/**
 * `ConversionAsset.identifier` is documented as `None` for BTC/sats and a token identifier
 * or contract address for everything else, so its absence is what marks the bitcoin end of
 * a swap. Reading the ticker instead would tie the classification to a string the SDK is
 * free to spell differently per chain.
 */
const isBitcoinSide = (asset: { identifier: string | undefined }): boolean =>
  asset.identifier === undefined

/**
 * The overall direction of a swap, taken from the first leg's source and the last leg's
 * destination. The SDK models a conversion as an ordered list — `[AMM, cross-chain]` for
 * sends, the reverse for receives — so the ends of the list are the ends of the swap, and
 * any intermediate asset is routing rather than intent.
 */
const conversionSidesOf = (
  details: ConversionDetails,
): { fromIsBitcoin: boolean; toIsBitcoin: boolean } | null => {
  const legs = details.conversions
  if (!legs?.length) return null

  return {
    fromIsBitcoin: isBitcoinSide(legs[0].from.asset),
    toIsBitcoin: isBitcoinSide(legs[legs.length - 1].to.asset),
  }
}

/**
 * A completed dollar↔bitcoin swap. Carries the direction and no amount: swap volume
 * waits on a policy decision rather than on engineering work.
 *
 * Gated on the *conversion's* status, not the payment's. A conversion's send leg can
 * succeed while the swap as a whole is still in flight, and counting that as a settled swap
 * is the overcount this event exists to avoid.
 */
const logConversionSettled = (payment: Payment, details: ConversionDetails): void => {
  if (details.status !== ConversionStatus.Completed) return

  const sides = conversionSidesOf(details)
  if (!sides) return

  const conversionDirection = classifyConversionDirection(sides)
  if (!conversionDirection) return

  captureTelemetryFact(
    {
      event: TelemetryEvent.ConversionSettled,
      telemetryEventId: mintTelemetryEventId(),
      walletProvider: WalletProvider.Spark,
      conversionDirection,
    },
    payment.id ?? null,
  )
}

/**
 * A settled self-custodial payment, in either direction, and the settled swaps that
 * arrive on the same event.
 *
 * Called for **every** SDK-observed settled receive, not only those arriving at the
 * Lightning Address: direct Spark transfers and plain BOLT11 invoices are in scope,
 * and an LNURL-derived count would understate receives by however much the wallet is used
 * without its address.
 */
export const logPaymentSettled = (payment: Payment): void =>
  safely("payment_settled", () => {
    /** Settled means `Completed`. The listener already narrows to `PaymentSucceeded`; this is
     *  the second half of the same statement, and cheap. */
    if (payment.status !== PaymentStatus.Completed) return

    /**
     * A conversion's legs settle as ordinary token payments, so counting one here as well
     * would count a swap twice — once as a swap and again as a payment. The swap event is
     * the one that describes what the user did, so this record becomes that instead.
     */
    if (payment.conversionDetails) {
      logConversionSettled(payment, payment.conversionDetails)
      return
    }

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
 * An Enhanced user successfully onboarding another user.
 *
 * Declared but not yet called: the app has no self-custodial referral surface today — the
 * invite flow behind Circles is custodial and needs an authenticated `me`. The contract
 * lives here so the event is specified when that flow is built; until then the board's
 * Enhanced onboarding tile has no client source and should read as unbuilt, not as zero.
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
