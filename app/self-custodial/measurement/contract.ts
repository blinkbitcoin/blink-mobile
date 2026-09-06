/**
 * The closed telemetry contract. Every field an event may carry is declared here, with
 * its value domain as an enumeration rather than a string, so a prohibited value cannot
 * be smuggled through an allowed field without failing to type-check (FR-18, FR-57).
 *
 * Adding a field or an event to this file is a privacy review, not a code change.
 *
 * PRD: §5.3 approved field allowlist, §5.4 prohibited fields, §5.5 derivation rule.
 */

/** Which custody model produced the event. Attached by the classifier to every event so
 *  mode is explicit in the payload rather than inferred downstream (FR-8). */
export const WalletProvider = {
  Custodial: "custodial",
  Spark: "spark",
} as const

export type WalletProvider = (typeof WalletProvider)[keyof typeof WalletProvider]

export const TelemetryDirection = {
  Send: "send",
  Receive: "receive",
} as const

export type TelemetryDirection =
  (typeof TelemetryDirection)[keyof typeof TelemetryDirection]

/**
 * Coarse rails only (FR-16, CD-5). The BOLT11-versus-LNURL-pay split is P4 and
 * conditional on the SDK preserving the original destination type (FR-17); until then a
 * Lightning settlement is just `lightning`, and the board tile for the finer split stays
 * absent rather than guessed at.
 */
export const RailType = {
  Lightning: "lightning",
  Spark: "spark",
  Onchain: "onchain",
} as const

export type RailType = (typeof RailType)[keyof typeof RailType]

export const TelemetryConversionDirection = {
  UsdToBtc: "usd_to_btc",
  BtcToUsd: "btc_to_usd",
} as const

export type TelemetryConversionDirection =
  (typeof TelemetryConversionDirection)[keyof typeof TelemetryConversionDirection]

export const MeasurementEvent = {
  PaymentSettled: "payment_settled",
  ConversionSettled: "conversion_settled",
  ReferralCompleted: "referral_completed",
} as const

export type MeasurementEvent = (typeof MeasurementEvent)[keyof typeof MeasurementEvent]

/**
 * Schema version per event (FR-14), so a downstream reader can tell a contract change
 * from a behaviour change. Bump the entry when an event's field set changes; never
 * reuse a version for a different shape.
 *
 * This is the one payload field that is not in the §5.3 allowlist, and deliberately so:
 * §5.3 governs fields describing the *user*, while this is a constant describing the
 * *schema*. It is identical for every device and therefore carries no information about
 * anyone. FR-14 requires it; §5.6 is untouched by it.
 */
export const EVENT_VERSION: Record<MeasurementEvent, number> = {
  [MeasurementEvent.PaymentSettled]: 1,
  [MeasurementEvent.ConversionSettled]: 1,
  [MeasurementEvent.ReferralCompleted]: 1,
}

/**
 * A random identifier minted once per payment and reused across every callback for that
 * payment, which is the only deduplication mechanism available once Option A was
 * rejected (CD-1) and dedup moved to the reporting layer (FR-26).
 *
 * It is safe precisely because it is derived from nothing (FR-23). See `event-id.ts` for
 * the local mapping that keeps it stable, and `policy.ts` for the shape check that stops
 * a payment hash being passed off as one.
 */
export type TelemetryEventId = string

export type PaymentSettledEvent = {
  event: typeof MeasurementEvent.PaymentSettled
  walletProvider: WalletProvider
  direction: TelemetryDirection
  railType: RailType
  telemetryEventId: TelemetryEventId
}

export type ConversionSettledEvent = {
  event: typeof MeasurementEvent.ConversionSettled
  walletProvider: WalletProvider
  conversionDirection: TelemetryConversionDirection
  telemetryEventId: TelemetryEventId
}

export type ReferralCompletedEvent = {
  event: typeof MeasurementEvent.ReferralCompleted
  walletProvider: WalletProvider
  telemetryEventId: TelemetryEventId
}

export type DomainEvent =
  | PaymentSettledEvent
  | ConversionSettledEvent
  | ReferralCompletedEvent

/** The wire payload: snake_case keys, matching what the board's reporting models read. */
export type TelemetryPayload = Readonly<Record<string, string | number>>
