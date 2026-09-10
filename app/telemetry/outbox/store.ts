import RNFS from "react-native-fs"

import { reportBoundaryFault } from "../diagnostics"

import { dedupKeyFor, OutboxState, parseOutboxRecord, type OutboxRecord } from "./record"

/**
 * The outbox store (AD-6, AD-18): a dedicated directory, one per `(accountId, network)`,
 * **sibling to the wallet store and never inside it**. `storageDirFor` is the Breez wallet
 * directory, and its only existing pairing with `unlink` is account deletion — discarding
 * an outbox against that path would destroy live wallet state.
 *
 * AsyncStorage is not used either: discard there is a `getAllKeys` prefix sweep, which is
 * the partial-delete failure this store exists to avoid. Neither primitive is atomic, so
 * discard is idempotent and re-run on activation.
 *
 * One file per record, named by its dedup key, so a second callback for the same settlement
 * finds the file present and writes nothing.
 */

export const OUTBOX_MAX_RECORDS = 500
export const OUTBOX_TTL_MS = 72 * 60 * 60 * 1000

/**
 * Loss counters (FR-68). Each source is separate because CM-5 must tell them apart: one is
 * age, one is pressure, one is the receiver's refusal. `expired` and `evicted` together are
 * the device-side share of FR-29's 2% budget, which AD-17 allocates as ≤1%.
 *
 * The capacity above is sized backwards from that: at a handful of settlements a day, a 72h
 * window holds tens of records, so 500 leaves roughly two orders of magnitude of headroom
 * and **any** non-zero eviction count is a defect signal rather than noise. The precise
 * alerting threshold is Q8, open with data.
 */
const counters = {
  enqueued: 0,
  deduplicated: 0,
  evicted: 0,
  expired: 0,
  acknowledged: 0,
  rejected: 0,
  discarded: 0,
}

export type OutboxCounters = Readonly<typeof counters>

export const getOutboxCounters = (): OutboxCounters => ({ ...counters })

export const resetOutboxCountersForTesting = (): void => {
  for (const key of Object.keys(counters) as (keyof typeof counters)[]) {
    counters[key] = 0
  }
}

const bump = (key: keyof typeof counters, by = 1): void => {
  counters[key] += by
}

export type OutboxStore = {
  readonly directory: string
  enqueue: (record: OutboxRecord) => Promise<void>
  /** Everything still deliverable, expired records swept out first. */
  pending: () => Promise<OutboxRecord[]>
  markSubmitted: (record: OutboxRecord) => Promise<void>
  acknowledge: (record: OutboxRecord) => Promise<void>
  reject: (record: OutboxRecord) => Promise<void>
  requeue: (record: OutboxRecord) => Promise<void>
  /** FR-5. Idempotent: safe to re-run on activation after a half-finished delete. */
  discardAll: () => Promise<void>
}

const fileFor = (directory: string, record: OutboxRecord): string =>
  `${directory}/${dedupKeyFor(record)}.json`

const write = async (directory: string, record: OutboxRecord): Promise<void> => {
  await RNFS.mkdir(directory)
  await RNFS.writeFile(fileFor(directory, record), JSON.stringify(record), "utf8")
}

const remove = async (path: string): Promise<void> => {
  try {
    await RNFS.unlink(path)
  } catch {
    /** Already gone. Two drains racing the same record is not a fault. */
  }
}

type StoredRecord = { record: OutboxRecord; path: string }

const readAll = async (directory: string): Promise<StoredRecord[]> => {
  if (!(await RNFS.exists(directory))) return []

  const entries = await RNFS.readDir(directory)
  const stored: StoredRecord[] = []

  for (const entry of entries.filter((file) => file.name.endsWith(".json"))) {
    try {
      const record = parseOutboxRecord(await RNFS.readFile(entry.path, "utf8"))
      if (record) stored.push({ record, path: entry.path })
      else await remove(entry.path)
    } catch (err) {
      reportBoundaryFault("outbox read", err)
    }
  }

  return stored
}

export const createOutboxStore = (directory: string): OutboxStore => {
  /** Serialised, because two settlements arriving together would otherwise both read a
   *  below-capacity directory and both write. */
  let queue: Promise<unknown> = Promise.resolve()
  const serialise = <T>(run: () => Promise<T>): Promise<T> => {
    const next = queue.then(run, run)
    queue = next.catch(() => undefined)
    return next
  }

  const sweep = async (): Promise<StoredRecord[]> => {
    const stored = await readAll(directory)
    const cutoff = Date.now() - OUTBOX_TTL_MS

    const live: StoredRecord[] = []
    for (const entry of stored) {
      if (entry.record.queuedAt <= cutoff) {
        await remove(entry.path)
        bump("expired")
      } else {
        live.push(entry)
      }
    }

    /** Oldest-first, so eviction under pressure drops what is closest to expiring anyway.
     *  Eviction removes records from the queue and never reorders what is submitted, so
     *  AD-22's ordering rule does not reach it. */
    live.sort((a, b) => a.record.queuedAt - b.record.queuedAt)
    return live
  }

  const enqueue = async (record: OutboxRecord): Promise<void> => {
    const live = await sweep()

    if (
      live.some(
        (entry) =>
          entry.record.sdkPaymentId === record.sdkPaymentId &&
          record.sdkPaymentId !== null,
      )
    ) {
      bump("deduplicated")
      return
    }

    const overflow = live.length + 1 - OUTBOX_MAX_RECORDS
    for (let i = 0; i < overflow; i += 1) {
      await remove(live[i].path)
      bump("evicted")
    }

    await write(directory, record)
    bump("enqueued")
  }

  const transition = async (record: OutboxRecord, state: OutboxState): Promise<void> => {
    await write(directory, { ...record, state })
  }

  return {
    directory,

    enqueue: (record) => serialise(() => enqueue(record)),

    pending: () => serialise(async () => (await sweep()).map((entry) => entry.record)),

    markSubmitted: (record) => serialise(() => transition(record, OutboxState.Submitted)),

    requeue: (record) => serialise(() => transition(record, OutboxState.Queued)),

    acknowledge: (record) =>
      serialise(async () => {
        await remove(fileFor(directory, record))
        bump("acknowledged")
      }),

    reject: (record) =>
      serialise(async () => {
        await remove(fileFor(directory, record))
        bump("rejected")
      }),

    discardAll: () =>
      serialise(async () => {
        const stored = await readAll(directory)
        try {
          await RNFS.unlink(directory)
        } catch {
          /** Never created, or already unlinked by a previous attempt. */
        }
        bump("discarded", stored.length)
      }),
  }
}
