import { TelemetryEvent, type ContractPayload } from "../contract"
import { recordDrainStats } from "../diagnostics"
import { isDrainPermitted, whenModeSettled } from "../mode"
import { getTelemetryTransport } from "../transport"

import { DRAIN_BACKOFF_INITIAL_MS, DRAIN_BACKOFF_MAX_MS } from "./config"
import type { OutboxRecord } from "./record"
import type { LossCounters, OutboxStore } from "./store"

/**
 * The drain.
 *
 * Events are emitted as the SDK reports settlements, so the order they are queued in is
 * the order they settled in. Sending them in that order would hand the receiver a
 * sequence it knows came from one device — a link between events that no amount of care
 * over payload fields can undo. So the queue is shuffled before anything is sent, and
 * sends are spaced by a random pause.
 *
 * What this does *not* fix: the app has no background execution — no background fetch, no
 * headless task, and the connectivity poll only runs in the foreground — so a drain always
 * runs while the device is in use. **When events arrive therefore still tracks when the
 * device was used.** That is a known limit, recorded against the metrics it affects.
 *
 * One payload at a time, never a batch: a batch tells the receiver outright that those
 * events came from one device, and most batches hold a single event anyway, which a
 * shuffle cannot disguise.
 *
 * Scheduling: one drain per account at a time — a trigger arriving while one is
 * running joins it rather than starting another. On `retryable` the account backs off
 * exponentially from 5 s to a 15 min cap, honouring the adapter's `retryAfterMs` where it
 * gives one; any `acknowledged` resets it. The triggers themselves — SDK connect, a
 * successful emission, app foreground — live in the provider, and none of them is the
 * 10 s connectivity poll.
 */

const MAX_JITTER_MS = 1500

const shuffled = <T>(items: readonly T[]): T[] => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export type DrainDeps = {
  shuffle?: <T>(items: readonly T[]) => T[]
  delay?: (ms: number) => Promise<void>
  /**
   * Files a `telemetry_loss_reported` for the loss not yet carried off the device.
   * Supplied by the boundary's public surface, which owns capture; the drain only decides
   * *when* — at most once per drain, and never while a previous report is still queued.
   */
  reportLoss?: (loss: LossCounters) => void
  now?: () => number
}

type Backoff = { nextAllowedAt: number; delayMs: number }
const backoffByStore = new Map<string, Backoff>()
const inFlightByStore = new Map<string, Promise<void>>()

export const resetDrainStateForTesting = (): void => {
  backoffByStore.clear()
  inFlightByStore.clear()
}

const lossCarriedBy = (record: OutboxRecord): LossCounters | null => {
  if (record.event !== TelemetryEvent.LossReported) return null
  const count = (value: unknown): number => (typeof value === "number" ? value : 0)
  return {
    expired: count(record.payload.expired),
    evicted: count(record.payload.evicted),
    rejected: count(record.payload.rejected),
    parseFailed: count(record.payload.parse_failed),
  }
}

const hasAnyLoss = (loss: LossCounters): boolean =>
  loss.expired + loss.evicted + loss.rejected + loss.parseFailed > 0

const toContractPayload = (record: OutboxRecord): ContractPayload => ({
  event: record.event,
  version: record.version,
  params: record.payload,
})

const runDrain = async (
  store: OutboxStore,
  { shuffle = shuffled, delay = pause, reportLoss, now = Date.now }: DrainDeps,
): Promise<void> => {
  /** A mode change in flight owns the queue until its discard has finished. */
  await whenModeSettled()

  /** The gate covers the drain, not just capture. An account can queue events,
   *  switch to incognito while inactive, and flush them on next activation — which is
   *  flushing exactly what the switch was supposed to destroy. */
  if (!isDrainPermitted()) return

  const transport = getTelemetryTransport()
  if (!transport) return

  const backoff = backoffByStore.get(store.directory)
  if (backoff && now() < backoff.nextAllowedAt) return

  const startedAt = now()
  let rejected = 0
  let retryable = 0

  /**
   * The lease is taken before the read, so a discard landing between the two leaves the
   * lease stale rather than the read fresh. Every write from here on presents it. A
   * transport result that arrives after a discard — the mode switched while the submit
   * was in flight, and the discard ran to completion — must not write the record back,
   * nor its loss, nor its tombstone: the directory it would recreate is the successor of
   * a queue the switch destroyed, and a later grant would drain it. The mode is
   * not enough to tell, because Enhanced → Anon → Enhanced can complete before the
   * response returns; the generation is.
   */
  const lease = store.lease()
  let queued = await store.pending()

  /** The loss report rides the same queue as everything else, so it is gated,
   *  shuffled, deduplicated and acknowledged like any other record. The queue is read
   *  again only when a report was just filed, so that it rides this drain. */
  if (reportLoss) {
    const loss = await store.unreportedLoss()
    const alreadyQueued = queued.some(
      (record) => record.event === TelemetryEvent.LossReported,
    )
    if (hasAnyLoss(loss) && !alreadyQueued) {
      reportLoss(loss)
      queued = await store.pending()
    }
  }

  const records = shuffle(queued)

  for (const record of records) {
    /** Re-checked between submissions: a mode switch mid-drain must stop the next one,
     *  and the discard it triggers must not race a submission already in flight. */
    if (!isDrainPermitted()) break

    /** A stale lease here means the queue these records came from is gone. */
    if (!(await store.markSubmitted(record, lease))) break

    /**
     * Checked again here, not just at the top of the iteration: `markSubmitted` is a
     * disk write, and a switch to incognito during that await closes the gate
     * synchronously while this iteration is already past its first check. A submit
     * after that would be the one event the discard cannot take back. The record is
     * left `submitted`; the discard the switch queued unlinks it behind us, and if it
     * somehow survives it returns to `queued` at the next startup.
     *
     * And the lease, synchronously, in the same breath: Enhanced → Anon → Enhanced can
     * complete inside that one write, leaving the mode saying yes while the queue this
     * record came from has already been condemned. The result of such a submit would be
     * refused as stale, but the event would have left the device. The generation is what
     * knows; the mode does not.
     */
    if (!isDrainPermitted() || store.lease() !== lease) break

    const result = await transport.submit(toContractPayload(record))

    if (result.kind === "acknowledged" || result.kind === "handed_off") {
      /** `handed_off` collapses `submitted → acknowledged` into one transition.
       *  Whether such an adapter may be chosen at all is a separate decision. */
      if (!(await store.acknowledge(record, lease))) break
      const carried = lossCarriedBy(record)
      if (carried) await store.settleReportedLoss(carried, lease)
      backoffByStore.delete(store.directory)
    } else if (result.kind === "rejected") {
      if (!(await store.reject(record, lease))) break
      rejected += 1
    } else {
      if (!(await store.requeue(record, lease))) break
      retryable += 1
      /** Doubles only while the previous refusal is still fresh — its window has not
       *  been over for longer than it lasted. A refusal after a day offline is a new
       *  first refusal, not the next step of one that ended yesterday. */
      const previous = backoffByStore.get(store.directory)
      const fresh = previous && now() < previous.nextAllowedAt + previous.delayMs
      const delayMs = Math.min(
        DRAIN_BACKOFF_MAX_MS,
        fresh ? previous.delayMs * 2 : DRAIN_BACKOFF_INITIAL_MS,
      )
      backoffByStore.set(store.directory, {
        delayMs,
        nextAllowedAt: now() + (result.retryAfterMs ?? delayMs),
      })
      /** The transport said not now; asking again with the next record is not listening. */
      break
    }

    await delay(Math.floor(Math.random() * MAX_JITTER_MS))
  }

  recordDrainStats({
    durationMs: now() - startedAt,
    depth: await store.depth(),
    rejected,
    retryable,
  })
}

export const drainOutbox = (store: OutboxStore, deps: DrainDeps = {}): Promise<void> => {
  const inFlight = inFlightByStore.get(store.directory)
  if (inFlight) return inFlight

  const run = runDrain(store, deps).finally(() => {
    inFlightByStore.delete(store.directory)
  })
  inFlightByStore.set(store.directory, run)
  return run
}
