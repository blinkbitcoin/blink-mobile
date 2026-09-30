/* eslint-disable camelcase -- wire names are the contract; snake_case is what the relay reads */
/**
 * The closed telemetry contract, as data.
 *
 * One row per event: its name, schema version, every parameter it may carry with that
 * parameter's value domain, and the modes permitted to emit it. Nothing else in the app
 * decides what an event is. The policy stage validates against these rows; the mode gate
 * reads the `modes` column; the fact type mirrors the parameter lists; and a build step
 * emits `telemetry-contract.v<version>.json` from this table so the landing schema, the
 * relay's allowlist and the dbt column tests derive from the same source rather than
 * restating it by hand.
 *
 * Adding a row or a parameter here is a privacy review, not a code change.
 *
 * Every domain is an enumeration, a boolean, a bounded integer or a pinned shape — never a
 * free string. A free-form field is how an identifier gets smuggled into a payload, so
 * there are none.
 *
 * The contract does not depend on a transport: this file imports nothing
 * transport-specific, and the current transport's limits are recorded at the bottom as
 * *constraints on* the contract rather than as its definition. Relocating this file to a
 * shared Blink-owned package is a move, not a rewrite.
 */

/** Which custody model produced the event. Written at emission and never recomputed at
 *  drain time: an account's mode may differ by then, and an event filed under the wrong
 *  wallet is as damaging as one that should never have been sent. */
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
 * Coarse rails only. Splitting BOLT11 from LNURL-pay is later work, and depends on the SDK
 * keeping the original destination type.
 *
 * `unknown` is a classification outcome, never a delivery or enrichment one: it
 * originates only where the SDK itself reports an unknown method. It exists so an
 * unclassifiable settlement is *counted in its own bucket* rather than dropped — a drop
 * would leave the rail split silently short of the settled total, and the existing
 * transaction mapper's habit of masking `Unknown` as Lightning would silently inflate one
 * real bucket instead. Any chart splitting by rail shows this slice.
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

/** The backup methods the onboarding flow offers. Mirrors the producer's union in
 *  `app/self-custodial/analytics.ts`, pinned here so the domain is a contract fact. */
export const BackupMethod = {
  Manual: "manual",
  GoogleDrive: "google_drive",
  ICloud: "icloud",
  Keychain: "keychain",
} as const

export type BackupMethod = (typeof BackupMethod)[keyof typeof BackupMethod]

/**
 * The modes that may emit at all. `Anon` and `Unresolved` never do, whatever the row says,
 * so they have no place in a `modes` column.
 */
export const EmittingMode = {
  Custodial: "custodial",
  Enhanced: "enhanced",
} as const

export type EmittingMode = (typeof EmittingMode)[keyof typeof EmittingMode]

export const TelemetryEvent = {
  PaymentSettled: "payment_settled",
  ConversionSettled: "conversion_settled",
  ReferralCompleted: "referral_completed",
  /** The four events `app/self-custodial/analytics.ts` already ships. */
  BackupCompleted: "self_custodial_backup_completed",
  RestoreCompleted: "self_custodial_restore_completed",
  StableBalanceActivated: "self_custodial_stable_balance_activated",
  RolloutExposed: "self_custodial_rollout_exposed",
  /** The loss pipeline's own event. */
  LossReported: "telemetry_loss_reported",
} as const

export type TelemetryEvent = (typeof TelemetryEvent)[keyof typeof TelemetryEvent]

/**
 * A parameter's value domain. The policy stage checks values against these; a test pins
 * that no domain is an unbounded string.
 */
export type ParamDomain =
  | { readonly kind: "enum"; readonly values: readonly string[] }
  | { readonly kind: "boolean" }
  /** A non-negative integer. Only the loss counters use it. */
  | { readonly kind: "count" }
  /** A v4 UUID, and nothing that merely looks like one — see `policy.ts`. */
  | { readonly kind: "uuid_v4" }
  /** The positive integer every event carries as `event_version`. */
  | { readonly kind: "schema_version" }

export type ContractRow = {
  readonly event: TelemetryEvent
  /** Bump when the parameter set changes; never reuse a version for a different shape. */
  readonly version: number
  /** Wire names, snake_case. `event_version`, `wallet_provider` and `telemetry_event_id`
   *  are on every row. */
  readonly params: Readonly<Record<string, ParamDomain>>
  /** The gate's second dimension. An event absent from a mode's list is suppressed there. */
  readonly modes: readonly EmittingMode[]
  /** Review status where admission is not yet final. */
  readonly review?: string
}

const enumOf = (values: Readonly<Record<string, string>>): ParamDomain => ({
  kind: "enum",
  values: Object.values(values),
})

/**
 * On every event. `event_version` is the only payload field outside the approved list,
 * deliberately: that list governs fields describing the *user*,
 * while this is a constant describing the *schema*, identical on every device.
 */
const COMMON_PARAMS = {
  event_version: { kind: "schema_version" },
  wallet_provider: enumOf(WalletProvider),
  telemetry_event_id: { kind: "uuid_v4" },
} as const satisfies Readonly<Record<string, ParamDomain>>

const BOTH_MODES: readonly EmittingMode[] = [
  EmittingMode.Custodial,
  EmittingMode.Enhanced,
]

/**
 * The four legacy events go to privacy review one at a time, and are expected to pass.
 * Until a row does, it is restricted to `Custodial` — what a row that failed would get
 * anyway — so its status on Enhanced is stated in the table rather than falling out of the
 * collection switch. Admitting one is a one-word change to its `modes`.
 *
 * What that means in practice, stated so nobody expects otherwise: `rollout_exposed` fires
 * from the feature-flags context on every device and so is emitted from custodial and
 * pre-account ones; the other three fire only inside self-custodial flows with that account
 * already active, so until their rows are admitted they are emitted from nowhere. That is
 * the park, not an accident — on `main` they went to GA4 from a self-custodial device,
 * which
 * is the emission the review exists to decide on.
 */
const PENDING_PRIVACY_REVIEW = "pending privacy review; custodial-only until it passes"

/**
 * The contract's own version, and the version in the generated artifact's file name
 * (`telemetry-contract.v1.json`). Bump it when the *set* of rows changes; an individual
 * row's parameter change bumps that row's `version` instead.
 */
export const CONTRACT_VERSION = 1

export const CONTRACT: readonly ContractRow[] = [
  {
    event: TelemetryEvent.PaymentSettled,
    version: 1,
    params: {
      ...COMMON_PARAMS,
      direction: enumOf(TelemetryDirection),
      rail_type: enumOf(RailType),
    },
    modes: BOTH_MODES,
  },
  {
    event: TelemetryEvent.ConversionSettled,
    version: 1,
    params: {
      ...COMMON_PARAMS,
      conversion_direction: enumOf(TelemetryConversionDirection),
    },
    modes: BOTH_MODES,
  },
  {
    event: TelemetryEvent.ReferralCompleted,
    version: 1,
    params: COMMON_PARAMS,
    modes: BOTH_MODES,
  },
  {
    event: TelemetryEvent.BackupCompleted,
    version: 1,
    params: { ...COMMON_PARAMS, backup_method: enumOf(BackupMethod) },
    modes: [EmittingMode.Custodial],
    review: PENDING_PRIVACY_REVIEW,
  },
  {
    event: TelemetryEvent.RestoreCompleted,
    version: 1,
    params: COMMON_PARAMS,
    modes: [EmittingMode.Custodial],
    review: PENDING_PRIVACY_REVIEW,
  },
  {
    event: TelemetryEvent.StableBalanceActivated,
    version: 1,
    /** The producer passes `SparkToken.Label` — one literal, and the domain says so. */
    params: { ...COMMON_PARAMS, label: { kind: "enum", values: ["USDB"] } },
    modes: [EmittingMode.Custodial],
    review: PENDING_PRIVACY_REVIEW,
  },
  {
    event: TelemetryEvent.RolloutExposed,
    version: 1,
    params: {
      ...COMMON_PARAMS,
      non_custodial_enabled: { kind: "boolean" },
      stable_balance_enabled: { kind: "boolean" },
      has_custodial_account: { kind: "boolean" },
    },
    modes: [EmittingMode.Custodial],
    review: PENDING_PRIVACY_REVIEW,
  },
  {
    event: TelemetryEvent.LossReported,
    version: 1,
    params: {
      ...COMMON_PARAMS,
      expired: { kind: "count" },
      evicted: { kind: "count" },
      rejected: { kind: "count" },
      parse_failed: { kind: "count" },
    },
    modes: BOTH_MODES,
    review:
      "accepted 2026-09-14 subject to privacy review, because it adds an event to a closed allowlist",
  },
]

const rowsByEvent: ReadonlyMap<string, ContractRow> = new Map(
  CONTRACT.map((row) => [row.event, row]),
)

export const contractRowFor = (event: string): ContractRow | undefined =>
  rowsByEvent.get(event)

/** The gate's first dimension. It asks this before a payload exists, which is why
 *  `TelemetryFact` needs no origin field. */
export const isContractEvent = (event: string): event is TelemetryEvent =>
  rowsByEvent.has(event)

/** Schema version per event, read off the table. */
export const eventVersionOf = (event: TelemetryEvent): number =>
  rowsByEvent.get(event)?.version ?? 0

/**
 * Limits the *first* transport imposes, recorded here so the contract can be checked
 * against them without being defined by them. A test asserts the contract fits;
 * when the transport changes, these numbers change and the contract does not.
 */
export const TRANSPORT_CONSTRAINTS = {
  maxEventNameLength: 40,
  maxParametersPerEvent: 25,
  maxEventNames: 500,
} as const

/**
 * A random identifier minted once per payment, and the deduplication key the
 * reporting layer groups on. Stability across repeated callbacks is the outbox's
 * doing — it keys its records on the local SDK payment id — and `policy.ts` holds the shape
 * check that stops a payment hash being passed off as one.
 */
export type TelemetryEventId = string

/** The wire payload: snake_case keys, matching what the reporting models read. */
export type TelemetryPayload = Readonly<Record<string, string | number | boolean>>

/**
 * What the port carries: the event's name and version beside its payload, so an
 * adapter can route or version-check without parsing the payload for either.
 */
export type ContractPayload = {
  readonly event: TelemetryEvent
  readonly version: number
  readonly params: TelemetryPayload
}
