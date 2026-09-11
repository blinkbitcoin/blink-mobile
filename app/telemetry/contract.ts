/**
 * The closed telemetry contract: every event the app may emit and every field it may
 * carry, with each field's value domain as an enumeration rather than a string, so a
 * prohibited value cannot be smuggled through an allowed field without failing to
 * type-check (FR-18, FR-57, addendum A2.4).
 *
 * Adding a field or an event here is a privacy review, not a code change.
 *
 * The contract is transport-independent by construction (FR-63, AD-10): nothing in this
 * file imports a transport, and the current transport's limits are recorded below as
 * *constraints on* the contract rather than as its definition. Relocating this file to a
 * shared Blink-owned package is an FR-69 exit-criteria item, not a rewrite.
 *
 * PRD: §5.3 approved field allowlist, §5.4 prohibited fields, §5.5 derivation rule.
 */

/** Which custody model produced the event. Written at emission and never recomputed at
 *  drain time, because an account's mode may differ by then and FR-19 rates mislabelling
 *  as severe as a leak (AD-20). */
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
 * conditional on the SDK preserving the original destination type (FR-17).
 *
 * `unknown` is a classification outcome, never a delivery or enrichment one (AD-7): it
 * originates only where the SDK itself reports an unknown method. It exists so an
 * unclassifiable settlement is *counted in its own bucket* rather than dropped — a drop
 * would leave the rail split silently short of the settled total, and the existing
 * transaction mapper's habit of masking `Unknown` as Lightning would silently inflate one
 * real bucket instead. Any tile splitting by rail renders this slice (AD-8).
 */
export const RailType = {
  Lightning: "lightning",
  Spark: "spark",
  Onchain: "onchain",
  Unknown: "unknown",
} as const

export type RailType = (typeof RailType)[keyof typeof RailType]

export const TelemetryConversionDirection = {
  UsdToBtc: "usd_to_btc",
  BtcToUsd: "btc_to_usd",
} as const

export type TelemetryConversionDirection =
  (typeof TelemetryConversionDirection)[keyof typeof TelemetryConversionDirection]

/**
 * The whole contract. Anything not on this list is a **non-contract event** whatever code
 * path emits it — automatic, screen, session or auth — and the mode gate reads the name
 * against this list to decide (AD-5, FR-70).
 */
export const TelemetryEvent = {
  PaymentSettled: "payment_settled",
  ConversionSettled: "conversion_settled",
  ReferralCompleted: "referral_completed",
} as const

export type TelemetryEvent = (typeof TelemetryEvent)[keyof typeof TelemetryEvent]

const CONTRACT_EVENTS: readonly string[] = Object.values(TelemetryEvent)

/** AD-5's first axis. The gate asks this before a payload exists, which is why
 *  `TelemetryFact` needs no origin field. */
export const isContractEvent = (event: string): event is TelemetryEvent =>
  CONTRACT_EVENTS.includes(event)

/**
 * Schema version per event (FR-14, FR-63), so a downstream reader can tell a contract
 * change from a behaviour change. Bump the entry when an event's field set changes; never
 * reuse a version for a different shape.
 *
 * This is the one payload field that is not in the §5.3 allowlist, and deliberately so:
 * §5.3 governs fields describing the *user*, while this is a constant describing the
 * *schema*. It is identical on every device and therefore carries no information about
 * anyone, so §5.6's linkage rule is untouched by it.
 */
export const EVENT_VERSION: Record<TelemetryEvent, number> = {
  [TelemetryEvent.PaymentSettled]: 1,
  [TelemetryEvent.ConversionSettled]: 1,
  [TelemetryEvent.ReferralCompleted]: 1,
}

/**
 * Limits the *first* transport imposes, recorded here so the contract can be checked
 * against them without being defined by them (FR-63). A test asserts the contract fits;
 * when the transport changes, these numbers change and the contract does not.
 */
export const TRANSPORT_CONSTRAINTS = {
  maxEventNameLength: 40,
  maxParametersPerEvent: 25,
  maxEventNames: 500,
} as const

/**
 * A random identifier minted once per payment (FR-22, FR-23), and the deduplication key the
 * reporting layer groups on (FR-26). Stability across repeated callbacks is the outbox's
 * doing — it keys its records on the local SDK payment id — and `policy.ts` holds the shape
 * check that stops a payment hash being passed off as one.
 */
export type TelemetryEventId = string

/** The wire payload: snake_case keys, matching what the reporting models read. */
export type TelemetryPayload = Readonly<Record<string, string | number>>
