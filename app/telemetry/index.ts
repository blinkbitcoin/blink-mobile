import {
  eventVersionOf,
  TelemetryEvent,
  WalletProvider,
  type TelemetryPayload,
} from "./contract"
import {
  countMislabelledEvent,
  countUnroutedEvent,
  getDiagnosticCounters,
  logDiagnosticBreadcrumb,
  reportBoundaryFault,
} from "./diagnostics"
import { mintTelemetryEventId } from "./event-id"
import { wireNameOf, type TelemetryFact } from "./fact"
import {
  getTelemetryMode,
  isDrainPermitted,
  isEventPermitted,
  TelemetryMode,
} from "./mode"
import {
  drainOutbox,
  getOutboxCounters,
  type LossCounters,
  type OutboxStore,
} from "./outbox"
import { logPlatformEvent } from "./platform-analytics"
import { applyPrivacyPolicy, getDroppedEventCounts } from "./policy"

/**
 * The measurement boundary's only public surface (FR-1, NFR-P5).
 *
 *   TelemetryFact → gate → privacy policy → { outbox → port  |  platform SDK }
 *
 * Producers construct a `TelemetryFact` and call `captureTelemetryFact`. They never build a
 * payload, never see the outbox and cannot reach the port or the platform SDK, which is
 * what makes the policy stage unbypassable rather than merely conventional.
 *
 * Where an approved payload goes is decided here, from the resolved mode and nowhere else
 * (CD-7): on `Enhanced` it is filed in the outbox for the port; on `Custodial` it is handed
 * to GA4, which stays the custodial analytics platform. A producer cannot pick a carrier.
 */

/**
 * The store for the account currently active, mounted by the telemetry provider (AD-14).
 * `null` means there is nowhere to file an Enhanced event — the provider not yet mounted —
 * and an event captured then is counted locally and dropped rather than held in memory
 * against an account it may not belong to (AD-20).
 */
let activeOutbox: OutboxStore | null = null

export const setActiveOutbox = (store: OutboxStore | null): void => {
  activeOutbox = store
}

const toPayload = (fact: TelemetryFact): TelemetryPayload => {
  const { event, ...fields } = fact
  const payload: Record<string, string | number | boolean> = {
    // eslint-disable-next-line camelcase
    event_version: eventVersionOf(event),
  }
  for (const [key, value] of Object.entries(fields)) payload[wireNameOf(key)] = value
  return payload
}

/** The `walletProvider` a producer should write for the mode that is active now (AD-20).
 *  `null` where no event may be written at all. */
export const currentWalletProvider = (): WalletProvider | null => {
  const mode = getTelemetryMode()
  if (mode === TelemetryMode.Custodial) return WalletProvider.Custodial
  if (mode === TelemetryMode.Enhanced) return WalletProvider.Spark
  return null
}

/**
 * Files a fact for delivery.
 *
 * The gate runs first, before a payload is even built: suppression is not a filter applied
 * to a finished event — nothing is assembled, so there is nothing queued, nothing logged
 * and nothing to leak if a later stage misbehaves (§5.7, FR-19).
 *
 * `sdkPaymentId` is the local deduplication key and is never transmitted (FR-24). It is a
 * separate argument rather than a field of `TelemetryFact` so that the type crossing the
 * boundary stays exactly the contract.
 *
 * Nothing here may throw. The settlement listener that emits also drives the wallet
 * refresh, and a throw would cost the user their balance update to save a metric (NFR-R2).
 */
export const captureTelemetryFact = (
  fact: TelemetryFact,
  sdkPaymentId: string | null = null,
): void => {
  captureInto(activeOutbox, fact, sdkPaymentId)
}

/**
 * The capture pipeline with its destination named. `captureTelemetryFact` names the
 * mounted store; the drain's loss report names the store it is draining, which is not
 * always the same one — an account switch during a drain in flight would otherwise file
 * account A's loss into account B's queue, or drop it, and A would re-report the same
 * counts on every later drain.
 */
const captureInto = (
  target: OutboxStore | null,
  fact: TelemetryFact,
  sdkPaymentId: string | null,
): void => {
  try {
    if (!isEventPermitted(fact.event)) return

    /**
     * AD-20, enforced rather than assumed. `walletProvider` is written by the producer at
     * emission; the carrier is chosen here from the mode. If the two disagree, a settlement
     * callback has raced an account switch — a Spark-labelled fact arriving after the mode
     * resolved Custodial would otherwise be handed to GA4 with `user_pseudo_id` on it. A
     * mismatched fact is dropped and counted; it is never re-labelled.
     */
    if (fact.walletProvider !== currentWalletProvider()) {
      countMislabelledEvent()
      return
    }

    const payload = toPayload(fact)
    const verdict = applyPrivacyPolicy(fact.event, payload)
    if (!verdict.permitted) return

    const mode = getTelemetryMode()

    if (mode === TelemetryMode.Custodial) {
      logPlatformEvent(fact.event, payload)
      return
    }

    const store = target
    if (!store) {
      countUnroutedEvent()
      return
    }

    store
      .enqueue({
        telemetryEventId: fact.telemetryEventId,
        event: fact.event,
        version: verdict.row.version,
        payload,
        sdkPaymentId,
        queuedAt: Date.now(),
        state: "queued",
      })
      .then(() => onEmitted?.())
      .catch((err) => {
        reportBoundaryFault("outbox enqueue", err)
      })
  } catch (err) {
    reportBoundaryFault("capture", err)
  }
}

/** AD-26: a successful emission is one of the drain's three triggers. The provider
 *  registers the trigger; the boundary only fires it. */
let onEmitted: (() => void) | null = null

export const setEmissionListener = (listener: (() => void) | null): void => {
  onEmitted = listener
}

/**
 * Everything the pipeline knows about its own losses and its own health, in one object
 * (FR-68, AD-30, CM-5). The numbers are held in module scope and would otherwise die with
 * the process, which is what `reportTelemetryHealth` exists to prevent.
 */
export const getTelemetryHealth = (): Readonly<Record<string, number>> => ({
  ...getDiagnosticCounters(),
  ...getOutboxCounters(),
  ...Object.fromEntries(
    Object.entries(getDroppedEventCounts()).map(([key, count]) => [
      `dropped_${key}`,
      count,
    ]),
  ),
})

let lastReportedHealth = ""

/** Only when something moved: an unchanged snapshot every drain would bury the one that
 *  matters. Silent on a device required to emit zero, like every other diagnostic. */
const reportTelemetryHealth = (): void => {
  const snapshot = JSON.stringify(getTelemetryHealth())
  if (snapshot === lastReportedHealth) return
  /** Only a breadcrumb that actually left the device counts as reported. A suppressed one
   *  recorded here would consume the slot and swallow the first report a device makes
   *  after its mode becomes one that may report at all. */
  if (logDiagnosticBreadcrumb(`[telemetry] ${snapshot}`)) lastReportedHealth = snapshot
}

export const resetTelemetryHealthReportingForTesting = (): void => {
  lastReportedHealth = ""
  onEmitted = null
}

/**
 * AD-31: the loss the outbox has accumulated leaves the device as a contract event, through
 * the same gate and policy as everything else — so an `Anon` device never reports, and a
 * `walletProvider` rides on it like on any other row. It is filed into the store being
 * drained, and only while that store's drain is still permitted: a loss report is a Spark
 * device's, and after a switch to a custodial account it must neither go to GA4 nor into
 * another account's queue.
 */
const reportLossInto = (store: OutboxStore, loss: LossCounters): void => {
  if (!isDrainPermitted() || store !== activeOutbox) return
  captureInto(
    store,
    {
      event: TelemetryEvent.LossReported,
      telemetryEventId: mintTelemetryEventId(),
      walletProvider: WalletProvider.Spark,
      expired: loss.expired,
      evicted: loss.evicted,
      rejected: loss.rejected,
      parseFailed: loss.parseFailed,
    },
    null,
  )
}

/** Drains whichever store is mounted. Safe to call on any trigger; it is a no-op unless the
 *  mode permits draining and a transport is registered. */
export const drainActiveOutbox = async (): Promise<void> => {
  reportTelemetryHealth()

  const store = activeOutbox
  if (!store) return
  try {
    await drainOutbox(store, { reportLoss: (loss) => reportLossInto(store, loss) })
  } catch (err) {
    reportBoundaryFault("outbox drain", err)
  }
}

export {
  classifyConversionDirection,
  classifyDirection,
  classifyRail,
} from "./classifier"
export {
  BackupMethod,
  CONTRACT,
  contractRowFor,
  EmittingMode,
  isContractEvent,
  RailType,
  TelemetryConversionDirection,
  TelemetryDirection,
  TelemetryEvent,
  TRANSPORT_CONSTRAINTS,
  WalletProvider,
  type ContractPayload,
  type ContractRow,
} from "./contract"
export {
  getDiagnosticCounters,
  mayTransmitDiagnostics,
  reportBoundaryFault,
} from "./diagnostics"
export {
  applyServerKillSwitch,
  isKillSwitchEngaged,
  isTelemetryEnabled,
  restoreKillSwitch,
  setTelemetryRolloutEnabled,
} from "./enablement"
export { mintTelemetryEventId } from "./event-id"
export type { TelemetryFact } from "./fact"
export {
  ActiveAccountKind,
  deriveTelemetryMode,
  getTelemetryMode,
  initializeTelemetryGate,
  isDrainPermitted,
  isEventPermitted,
  isSuppressedMode,
  onTelemetrySuppressed,
  resolveTelemetryMode,
  TelemetryMode,
  type SelfCustodialModeAnswer,
  type TelemetryModeInputs,
} from "./mode"
// `OutboxRecord` and `OutboxStore` are deliberately absent from this surface: an adapter
// is handed a payload and never a row, which is what keeps the local-only `sdkPaymentId`
// out of its reach (AD-4).
export {
  createOutboxStore,
  getOutboxCounters,
  OUTBOX_MAX_RECORDS,
  OUTBOX_TTL_MS,
  sweepCondemnedOutboxes,
} from "./outbox"
export { getDroppedEventCounts } from "./policy"
export { setCustodialAnalyticsIdentity } from "./platform-analytics"
export {
  localOnlyTransport,
  registerTelemetryTransport,
  type LocalOnlyEntry,
  type SubmitResult,
  type TelemetryTransport,
} from "./transport"
