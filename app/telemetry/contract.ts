/* eslint-disable camelcase -- wire names are the contract; snake_case is what the relay reads */
/**
 * The closed telemetry contract, as data (AD-10, AD-23).
 *
 * One row per event: its name, schema version, every parameter it may carry with that
 * parameter's value domain, and the modes permitted to emit it. Nothing else in the app
 * decides what an event is. The policy stage validates against these rows; the mode gate
 * reads the `modes` column; the fact type mirrors the parameter lists; and a build step
 * emits `telemetry-contract.v<version>.json` from this table so the landing schema, the
 * relay's allowlist and the dbt column tests derive from the same source rather than
 * restating it by hand (FR-63, FR-65).
 *
 * Adding a row or a parameter here is a privacy review, not a code change (NFR-P8).
 *
 * Every domain is an enumeration, a boolean, a bounded integer or a pinned shape — never a
 * free string (FR-57, FR-73, addendum A2.4). Free-form string fields are the mechanism by
 * which the derivation rule gets broken, and there are none.
 *
 * The contract is transport-independent by construction: this file imports nothing
 * transport-specific, and the current transport's limits are recorded at the bottom as
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
 * so they have no place in a `modes` column (AD-5, AD-13).
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
  /** The four events `app/self-custodial/analytics.ts` already ships (AD-24). */
  BackupCompleted: "self_custodial_backup_completed",
  RestoreCompleted: "self_custodial_restore_completed",
  StableBalanceActivated: "self_custodial_stable_balance_activated",
  RolloutExposed: "self_custodial_rollout_exposed",
  /** The loss pipeline's own event (AD-31). */
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
  /** A non-negative integer. Only the loss counters use it (AD-31). */
  | { readonly kind: "count" }
  /** A v4 UUID, and nothing that merely looks like one — see `policy.ts`. */
  | { readonly kind: "uuid_v4" }
  /** The positive integer every event carries as `event_version`. */
  | { readonly kind: "schema_version" }

export type ContractRow = {
  readonly event: TelemetryEvent
  /** Bump when the parameter set changes; never reuse a version for a different shape (FR-14). */
  readonly version: number
  /** Wire names, snake_case. `event_version`, `wallet_provider` and `telemetry_event_id`
   *  are on every row. */
  readonly params: Readonly<Record<string, ParamDomain>>
  /** AD-5's second axis, per row. An event absent from a mode's list is suppressed there. */
  readonly modes: readonly EmittingMode[]
  /** Review status where admission is not yet final (AD-24, AD-31). */
  readonly review?: string
}

const enumOf = (values: Readonly<Record<string, string>>): ParamDomain => ({
  kind: "enum",
  values: Object.values(values),
})

/**
 * On every event (§5.3 plus the schema field). `event_version` is the one payload field
 * outside the §5.3 allowlist, deliberately: §5.3 governs fields describing the *user*,
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
 * The four legacy events go to privacy review case by case with admission expected
 * (AD-24). Until a row passes, it is restricted to `Custodial` — the outcome AD-24 names
 * for a row that fails — so their status on Enhanced is a contract fact rather than a side
 * effect of FR-70's collection toggle. Admitting one is a one-word change to its `modes`.
 */
const PENDING_AD24_REVIEW =
  "AD-24: pending privacy review; Custodial-only until it passes"

/**
 * The contract's own version, and the version in the generated artifact's file name
 * (`telemetry-contract.v1.json`). Bump it when the *set* of rows changes; an individual
 * row's parameter change bumps that row's `version` instead (FR-14).
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
    review: PENDING_AD24_REVIEW,
  },
  {
    event: TelemetryEvent.RestoreCompleted,
    version: 1,
    params: COMMON_PARAMS,
    modes: [EmittingMode.Custodial],
    review: PENDING_AD24_REVIEW,
  },
  {
    event: TelemetryEvent.StableBalanceActivated,
    version: 1,
    /** The producer passes `SparkToken.Label` — one literal, and the domain says so. */
    params: { ...COMMON_PARAMS, label: { kind: "enum", values: ["USDB"] } },
    modes: [EmittingMode.Custodial],
    review: PENDING_AD24_REVIEW,
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
    review: PENDING_AD24_REVIEW,
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
      "AD-31: accepted 2026-09-14 subject to FR-18 / NFR-P8 privacy review, because it adds an event to a closed allowlist",
  },
]

const rowsByEvent: ReadonlyMap<string, ContractRow> = new Map(
  CONTRACT.map((row) => [row.event, row]),
)

export const contractRowFor = (event: string): ContractRow | undefined =>
  rowsByEvent.get(event)

/** AD-5's first axis. The gate asks this before a payload exists, which is why
 *  `TelemetryFact` needs no origin field. */
export const isContractEvent = (event: string): event is TelemetryEvent =>
  rowsByEvent.has(event)

/** Schema version per event, read off the table (FR-14). */
export const eventVersionOf = (event: TelemetryEvent): number =>
  rowsByEvent.get(event)?.version ?? 0

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
export type TelemetryPayload = Readonly<Record<string, string | number | boolean>>

/**
 * What the port carries (AD-27): the event's name and version beside its payload, so an
 * adapter can route or version-check without parsing the payload for either.
 */
export type ContractPayload = {
  readonly event: TelemetryEvent
  readonly version: number
  readonly params: TelemetryPayload
}
