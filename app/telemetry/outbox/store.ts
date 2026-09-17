import RNFS from "react-native-fs"

import { eventVersionOf } from "../contract"
import { reportBoundaryFault } from "../diagnostics"

import {
  OUTBOX_MAX_RECORDS,
  OUTBOX_SCHEMA_VERSIONS_TOLERATED,
  OUTBOX_TTL_MS,
} from "./config"
import { dedupKeyFor, OutboxState, parseOutboxRecord, type OutboxRecord } from "./record"

/**
 * The outbox store (AD-6, AD-18, AD-26): a dedicated directory, one per `(accountId,
 * network)`, **sibling to the wallet store and never inside it**. `storageDirFor` is the
 * Breez wallet directory, and its only existing pairing with `unlink` is account deletion —
 * discarding an outbox against that path would destroy live wallet state.
 *
 * AsyncStorage is not used either: discard there is a `getAllKeys` prefix sweep, which is
 * the partial-delete failure this store exists to avoid.
 *
 * Layout:
 *
 *   <dir>/<dedup-key>.json      one file per record
 *   <dir>/<dedup-key>.json.tmp  a write in progress; never read back
 *   <dir>/loss.json             the unreported loss counters (AD-31)
 *   <dir>/acked.json            tombstones: SDK payment ids already delivered, so a
 *                               replay after cleanup cannot mint a second id
 *   <dir>.condemned-<ts>        a queue renamed out of its path by a discard (AD-26): never
 *                               read again, removed when it can be
 *   <dir>.discard               a discard that could not rename: while this sibling file
 *                               exists, nothing in the directory is readable as a queue
 *
 * Every record is written to a temp name and renamed into place, so a crash mid-write
 * leaves a `.tmp` the reader ignores rather than a half-record it has to guess at. AD-26
 * names files by `telemetryEventId`; they are named by the **dedup key** instead — the SDK
 * payment id where there is one — because that is what makes `enqueue` idempotent per
 * settlement: the second callback for a payment finds its file present and writes nothing,
 * so the id it minted never exists. Naming by `telemetryEventId` would need a second index
 * to achieve the same, and the spine's own Identifiers row says the id is minted *once per
 * payment*; the file name is the mechanism that makes "once" true.
 */

/**
 * Loss counters (FR-68, AD-31). Each source is separate because CM-5 must tell them apart:
 * one is age, one is pressure, one is the receiver's refusal, one is a record this build
 * could not read. `expired` and `evicted` together are the device-side share of FR-29's 2%
 * budget, which AD-17 allocates as ≤1%.
 *
 * The persisted copy in `loss.json` is the *unreported* loss: incremented on the event,
 * and reduced only when a `telemetry_loss_reported` carrying those counts is acknowledged.
 * The in-memory copy below is the lifetime total for this process, for diagnostics.
 */
export type LossCounters = {
  expired: number
  evicted: number
  rejected: number
  parseFailed: number
}

const EMPTY_LOSS: LossCounters = { expired: 0, evicted: 0, rejected: 0, parseFailed: 0 }

const counters = {
  /** Writes refused because a discard had run since the drain read the queue (AD-26). */
  staleWrites: 0,
  /** Enqueues refused because the account was deleted in this process (AD-6). */
  retiredWrites: 0,
  enqueued: 0,
  deduplicated: 0,
  evicted: 0,
  expired: 0,
  acknowledged: 0,
  rejected: 0,
  parseFailed: 0,
  discarded: 0,
}

export type OutboxCounters = Readonly<typeof counters>

export const getOutboxCounters = (): OutboxCounters => ({ ...counters })

/**
 * Serialised per *directory*, not per instance: two settlements arriving together would
 * otherwise both read a below-capacity directory and both write, and two instances over
 * the same directory — the provider's active store and the FR-25 sweep's — would race
 * each other's read-modify-write of the loss counters and the tombstones.
 */
const queueByDirectory = new Map<string, Promise<unknown>>()

/** Directories with a discard begun in this process and not yet verified finished. The
 *  on-disk marker is the signal that survives a restart; this is the one that survives a
 *  marker that could not be written. Entered synchronously, the moment a discard is
 *  asked for, before any filesystem operation can fail. */
const discardOwed = new Set<string>()

/**
 * Directories retired with their account (AD-6 pairing). Permanent for the process: a
 * settlement for a deleted account cannot enqueue, whatever the mode says, and a store
 * created later for the same path — the same wallet restored in the same session —
 * inherits the refusal and counts what it refuses, until the next launch.
 */
const retiredDirectories = new Set<string>()

/**
 * The queue's generation, per directory: bumped synchronously by every discard. A drain
 * takes a lease on it before it reads the queue and presents the lease with every write
 * that follows; a write whose lease is stale is refused. This is what stops a transport
 * result that was in flight while the mode switched — and while the discard ran to
 * completion — from writing the record, its loss or its tombstone into the successor of
 * a queue that no longer exists (the third review's HIGH). A mode check cannot do this
 * job: Enhanced → Anon → Enhanced can complete before the response returns, and the
 * current mode then says yes.
 */
const generationByDirectory = new Map<string, number>()

export type OutboxLease = number

const generationOf = (directory: string): number =>
  generationByDirectory.get(directory) ?? 0

/** Counters and the per-directory module state — the serial queues, the owed discards
 *  and the generations — so a suite that resets the mock disk starts from nothing on
 *  this side too. */
export const resetOutboxCountersForTesting = (): void => {
  for (const key of Object.keys(counters) as (keyof typeof counters)[]) {
    counters[key] = 0
  }
  queueByDirectory.clear()
  discardOwed.clear()
  generationByDirectory.clear()
  retiredDirectories.clear()
}

const bump = (key: keyof typeof counters, by = 1): void => {
  counters[key] += by
}

export type OutboxStore = {
  readonly directory: string
  enqueue: (record: OutboxRecord) => Promise<void>
  /** Everything still deliverable, expired and unreadable records swept out first. */
  pending: () => Promise<OutboxRecord[]>
  depth: () => Promise<number>
  /**
   * A lease on the queue as it is right now, taken *before* `pending()` so a discard
   * that lands between the two leaves the lease stale rather than the read fresh. Every
   * write below that follows a read presents it, and resolves `false` — nothing written —
   * when a discard has run since.
   */
  lease: () => OutboxLease
  markSubmitted: (record: OutboxRecord, lease: OutboxLease) => Promise<boolean>
  acknowledge: (record: OutboxRecord, lease: OutboxLease) => Promise<boolean>
  reject: (record: OutboxRecord, lease: OutboxLease) => Promise<boolean>
  requeue: (record: OutboxRecord, lease: OutboxLease) => Promise<boolean>
  /** The loss not yet carried off the device by a `telemetry_loss_reported` (AD-31). */
  unreportedLoss: () => Promise<LossCounters>
  /** Called once the report carrying `reported` is acknowledged. */
  settleReportedLoss: (reported: LossCounters, lease: OutboxLease) => Promise<boolean>
  /** FR-5. Idempotent: safe to re-run on activation after a half-finished delete. The
   *  queue's generation moves the instant this is called, before anything touches disk. */
  discardAll: () => Promise<void>
  /**
   * The account is gone (AD-6): a discard, and then the path refuses to be a queue again
   * for the rest of the process. Account deletion must come here rather than unlink the
   * directory itself — a bare unlink neither moves the generation nor serialises, so a
   * transport result in flight would write the deleted account's queue back.
   */
  retire: () => Promise<void>
  /** AD-26: a discard begun here or in a previous run did not finish. */
  hasPendingDiscard: () => Promise<boolean>
}

const LOSS_FILE = "loss.json"
const ACKED_FILE = "acked.json"
/** Siblings of the directory, in its parent — outside the thing being removed. */
const CONDEMNED_INFIX = ".condemned-"
const DISCARD_TOMBSTONE_SUFFIX = ".discard"
const TEMP_SUFFIX = ".tmp"

/**
 * Deduplication does not end when an acknowledged record is deleted (A2.3, FR-26). The SDK
 * can re-deliver a settlement after the record that carried it has been cleaned — a resync
 * after a restart, a listener re-attached — and a fresh `telemetry_event_id` at that point
 * is a row the warehouse cannot collapse. So the SDK payment id of every acknowledged
 * record is kept as a tombstone for the TTL, and `enqueue` refuses a key it has seen.
 * Bounded and pruned by age, so a busy device cannot grow it forever.
 */
const TOMBSTONES_MAX = 2_000
type Tombstones = Record<string, number>

const fileFor = (directory: string, record: OutboxRecord): string =>
  `${directory}/${dedupKeyFor(record)}.json`

const remove = async (path: string): Promise<void> => {
  try {
    await RNFS.unlink(path)
  } catch {
    /** Already gone. Two drains racing the same record is not a fault. */
  }
}

/**
 * Temp-and-rename (AD-26). `RNFS.moveFile` is a rename on the same volume, so a reader
 * never sees the front half of a file. What it is *not*, on iOS, is a replace:
 * `NSFileManager moveItemAtPath:toPath:` refuses an existing destination (Android's
 * `renameTo` overwrites), so a rewrite — a state transition, the loss counters, the
 * tombstones — removes the destination before the move. The window between the two is
 * covered by the readers: a `.tmp` whose final file is missing is read *as* the file, so
 * a process that dies inside the window loses nothing, and a `.tmp` beside a present
 * final is a write that never finished, ignored and cleaned on the next sweep.
 */
const writeAtomically = async (path: string, contents: string): Promise<void> => {
  const temp = `${path}${TEMP_SUFFIX}`
  await RNFS.writeFile(temp, contents, "utf8")
  await remove(path)
  await RNFS.moveFile(temp, path)
}

/** The file, or the complete `.tmp` a death inside `writeAtomically` left in its place. */
const readFileOrTemp = async (path: string): Promise<string> => {
  try {
    return await RNFS.readFile(path, "utf8")
  } catch (err) {
    if (await RNFS.exists(`${path}${TEMP_SUFFIX}`)) {
      return RNFS.readFile(`${path}${TEMP_SUFFIX}`, "utf8")
    }
    throw err
  }
}

const write = async (directory: string, record: OutboxRecord): Promise<void> => {
  await RNFS.mkdir(directory)
  await writeAtomically(fileFor(directory, record), JSON.stringify(record))
}

type StoredRecord = { record: OutboxRecord; path: string }

const isRecordFile = (name: string): boolean =>
  name.endsWith(".json") && name !== LOSS_FILE && name !== ACKED_FILE

/**
 * Reads every record file, deleting and counting the ones this build cannot parse. A
 * `.tmp` with no final file beside it is a record too — the one a death inside a rewrite
 * would otherwise have lost; a `.tmp` beside its final is a write that never finished and
 * is removed.
 */
const readAll = async (directory: string): Promise<StoredRecord[]> => {
  if (!(await RNFS.exists(directory))) return []

  const entries = await RNFS.readDir(directory)
  const names = new Set(entries.map((entry) => entry.name))
  const stored: StoredRecord[] = []

  const readOne = async (entry: { name: string; path: string }): Promise<void> => {
    const isTemp = entry.name.endsWith(`.json${TEMP_SUFFIX}`)
    const finalName = isTemp ? entry.name.slice(0, -TEMP_SUFFIX.length) : entry.name
    if (!isRecordFile(finalName)) return
    if (isTemp && names.has(finalName)) {
      await remove(entry.path)
      return
    }
    try {
      const record = parseOutboxRecord(await RNFS.readFile(entry.path, "utf8"))
      if (record) {
        stored.push({ record, path: `${directory}/${finalName}` })
        if (isTemp) await RNFS.moveFile(entry.path, `${directory}/${finalName}`)
      } else {
        await remove(entry.path)
        bump("parseFailed")
        await addLoss(directory, "parseFailed", 1)
      }
    } catch (err) {
      reportBoundaryFault("outbox read", err)
    }
  }
  for (const entry of entries) await readOne(entry)

  return stored
}

const readLoss = async (directory: string): Promise<LossCounters> => {
  try {
    const raw = await readFileOrTemp(`${directory}/${LOSS_FILE}`)
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_LOSS }
    const loss = parsed as Partial<LossCounters>
    const count = (value: unknown): number =>
      typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0
    return {
      expired: count(loss.expired),
      evicted: count(loss.evicted),
      rejected: count(loss.rejected),
      parseFailed: count(loss.parseFailed),
    }
  } catch {
    return { ...EMPTY_LOSS }
  }
}

const writeLoss = async (directory: string, loss: LossCounters): Promise<void> => {
  await RNFS.mkdir(directory)
  await writeAtomically(`${directory}/${LOSS_FILE}`, JSON.stringify(loss))
}

const addLoss = async (
  directory: string,
  key: keyof LossCounters,
  by: number,
): Promise<void> => {
  const loss = await readLoss(directory)
  await writeLoss(directory, { ...loss, [key]: loss[key] + by })
}

const readTombstones = async (directory: string): Promise<Tombstones> => {
  try {
    const parsed: unknown = JSON.parse(await readFileOrTemp(`${directory}/${ACKED_FILE}`))
    if (!parsed || typeof parsed !== "object") return {}
    const cutoff = Date.now() - OUTBOX_TTL_MS
    const live: Tombstones = {}
    for (const [key, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof at === "number" && at > cutoff) live[key] = at
    }
    return live
  } catch {
    return {}
  }
}

const writeTombstones = async (
  directory: string,
  tombstones: Tombstones,
): Promise<void> => {
  const entries = Object.entries(tombstones).sort(([, a], [, b]) => b - a)
  await RNFS.mkdir(directory)
  await writeAtomically(
    `${directory}/${ACKED_FILE}`,
    JSON.stringify(Object.fromEntries(entries.slice(0, TOMBSTONES_MAX))),
  )
}

const addTombstone = async (directory: string, sdkPaymentId: string): Promise<void> => {
  const tombstones = await readTombstones(directory)
  await writeTombstones(directory, { ...tombstones, [sdkPaymentId]: Date.now() })
}

/**
 * Removes what discards leave behind in a parent directory: condemned queues whose
 * unlink failed, and tombstones whose directory is gone. Called on mount for the whole
 * outbox parent, so a queue retired with a *deleted* account — one no store will ever be
 * created for again — still gets cleaned up (the fourth review's HIGH). A tombstone whose
 * directory still exists is a discard that never finished; it is finished here.
 */
export const sweepCondemnedOutboxes = async (parent: string): Promise<void> => {
  let entries: { name: string; path: string }[]
  try {
    entries = await RNFS.readDir(parent)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.includes(CONDEMNED_INFIX)) {
      await RNFS.unlink(entry.path).catch(() => undefined)
    } else if (entry.name.endsWith(DISCARD_TOMBSTONE_SUFFIX)) {
      const directory = entry.path.slice(0, -DISCARD_TOMBSTONE_SUFFIX.length)
      if (await RNFS.exists(directory).catch(() => true)) {
        await createOutboxStore(directory)
          .discardAll()
          .catch(() => undefined)
      } else {
        await RNFS.unlink(entry.path).catch(() => undefined)
      }
    }
  }
}

/** A record written under a contract version the relay no longer accepts (AD-30). */
const isTooOld = (record: OutboxRecord): boolean =>
  record.version < eventVersionOf(record.event) - OUTBOX_SCHEMA_VERSIONS_TOLERATED

const serialiseOn = <T>(directory: string, run: () => Promise<T>): Promise<T> => {
  const queue = queueByDirectory.get(directory) ?? Promise.resolve()
  const next = queue.then(run, run)
  queueByDirectory.set(
    directory,
    next.catch(() => undefined),
  )
  return next
}

export const createOutboxStore = (directory: string): OutboxStore => {
  const serialise = <T>(run: () => Promise<T>): Promise<T> => serialiseOn(directory, run)

  const tombstonePath = `${directory}${DISCARD_TOMBSTONE_SUFFIX}`

  /**
   * Makes the queue unreadable, durably. The primary means is a rename: one atomic
   * operation moves the whole directory out of its path, so a process that dies the
   * instant after finds no queue at all — and a condemned directory is never read as
   * one, only removed. When the rename itself fails the signal goes *next to* the
   * directory instead of inside it: a tombstone file in the parent, which a failing
   * unlink cannot take with it, and which a restart still sees (the fourth review's
   * MEDIUM). Only a directory that survives every one of these throws, and then the
   * in-memory owed entry keeps refusing reads for the rest of the process.
   */
  const condemn = async (): Promise<void> => {
    const condemned = `${directory}${CONDEMNED_INFIX}${Date.now()}`
    let renamed = false
    try {
      await RNFS.moveFile(directory, condemned)
      renamed = true
    } catch {
      /** Absent, or the rename refused — decided below. */
    }
    if (renamed) {
      await RNFS.unlink(condemned).catch(() => undefined)
      await RNFS.unlink(tombstonePath).catch(() => undefined)
      return
    }
    try {
      await RNFS.writeFile(tombstonePath, String(Date.now()), "utf8")
    } catch {
      /** Best effort: the unlink is still attempted, and the check decides. */
    }
    try {
      await RNFS.unlink(directory)
    } catch {
      /** Already gone, or failed partway — the check below decides which. */
    }
    if (await RNFS.exists(directory)) {
      throw new Error("telemetry outbox discard did not finish")
    }
    await RNFS.unlink(tombstonePath).catch(() => undefined)
  }

  /**
   * Every read of the queue finishes a pending discard first, or fails. A discard that
   * died leaves records behind that the mode switch required destroyed; returning them
   * from `pending()` would hand them to the next drain (FR-5 by the back door), and
   * writing next to them would bury the signal under fresh records. So they are never
   * readable: either the removal completes now, or the store refuses the read.
   */
  const finishPendingDiscard = async (): Promise<void> => {
    if (!discardOwed.has(directory) && !(await RNFS.exists(tombstonePath))) return
    const stored = await countForDiscard()
    await condemn()
    discardOwed.delete(directory)
    bump("discarded", stored)
  }

  /** Best effort, for the health counter only: a directory that cannot be enumerated is
   *  still discarded. */
  const countForDiscard = async (): Promise<number> => {
    try {
      return (await readAll(directory)).length
    } catch {
      return 0
    }
  }

  const sweep = async (): Promise<{ live: StoredRecord[]; tombstones: Tombstones }> => {
    await finishPendingDiscard()
    const stored = await readAll(directory)
    const cutoff = Date.now() - OUTBOX_TTL_MS
    const tombstones = await readTombstones(directory)

    const live: StoredRecord[] = []
    let expired = 0
    for (const entry of stored) {
      if (entry.record.queuedAt <= cutoff || isTooOld(entry.record)) {
        await remove(entry.path)
        expired += 1
      } else if (
        entry.record.sdkPaymentId !== null &&
        entry.record.sdkPaymentId in tombstones
      ) {
        /** Acknowledged, and the process died before its file was removed: the tombstone
         *  is written first, so this is a record already delivered — not one to resubmit. */
        await remove(entry.path)
      } else {
        live.push(entry)
      }
    }
    if (expired > 0) {
      bump("expired", expired)
      await addLoss(directory, "expired", expired)
    }

    /** Oldest-first, so eviction under pressure drops what is closest to expiring anyway.
     *  Eviction removes records from the queue and never reorders what is submitted, so
     *  AD-22's ordering rule does not reach it. */
    live.sort((a, b) => a.record.queuedAt - b.record.queuedAt)
    return { live, tombstones }
  }

  const enqueue = async (record: OutboxRecord): Promise<void> => {
    if (retiredDirectories.has(directory)) {
      bump("retiredWrites")
      return
    }
    const { live, tombstones } = await sweep()

    if (record.sdkPaymentId !== null) {
      const queuedAlready = live.some(
        (entry) => entry.record.sdkPaymentId === record.sdkPaymentId,
      )
      const deliveredAlready = record.sdkPaymentId in tombstones
      if (queuedAlready || deliveredAlready) {
        bump("deduplicated")
        return
      }
    }

    const overflow = live.length + 1 - OUTBOX_MAX_RECORDS
    for (let i = 0; i < overflow; i += 1) {
      await remove(live[i].path)
    }
    if (overflow > 0) {
      bump("evicted", overflow)
      await addLoss(directory, "evicted", overflow)
    }

    await write(directory, record)
    bump("enqueued")
  }

  const transition = async (record: OutboxRecord, state: OutboxState): Promise<void> => {
    await write(directory, { ...record, state })
  }

  /**
   * FR-5, made re-runnable (AD-26). The signals come first and the filesystem second:
   * the generation and the owed set move synchronously in the caller (see `discardAll`
   * below), the directory is counted — best effort — and then condemned. A read that
   * fails before the signal existed would otherwise leave nothing to say a discard was
   * ever due, and the next grant would drain the records the switch required destroyed
   * (the third review's MEDIUM). Nothing to discard is not a failure; a directory that
   * survives is, and the error carries the owed entry with it for the next attempt.
   */
  const runDiscard = async (): Promise<void> => {
    if (!(await RNFS.exists(directory).catch(() => true))) {
      await RNFS.unlink(tombstonePath).catch(() => undefined)
      discardOwed.delete(directory)
      return
    }
    const stored = await countForDiscard()
    await condemn()
    discardOwed.delete(directory)
    bump("discarded", stored)
  }

  /** Synchronous, ahead of the serialised body and of any filesystem call: from this
   *  instant every outstanding lease is stale and every read owes the discard. */
  const beginDiscard = (): void => {
    generationByDirectory.set(directory, generationOf(directory) + 1)
    discardOwed.add(directory)
  }

  /** Refuses a write whose lease predates a discard. Nothing is written; the caller
   *  learns the queue it was working from is gone. */
  const leased = (lease: OutboxLease, run: () => Promise<void>): Promise<boolean> =>
    serialise(async () => {
      if (lease !== generationOf(directory)) {
        bump("staleWrites")
        return false
      }
      await run()
      return true
    })

  return {
    directory,

    enqueue: (record) => serialise(() => enqueue(record)),

    pending: () =>
      serialise(async () => (await sweep()).live.map((entry) => entry.record)),

    depth: () =>
      serialise(async () => {
        await finishPendingDiscard()
        return (await readAll(directory)).length
      }),

    lease: () => generationOf(directory),

    markSubmitted: (record, lease) =>
      leased(lease, () => transition(record, OutboxState.Submitted)),

    requeue: (record, lease) =>
      leased(lease, () => transition(record, OutboxState.Queued)),

    /** Tombstone first, file second. The other order has a window — a crash between the
     *  two — in which neither survives, and the SDK's next replay mints a second
     *  `telemetry_event_id` for a settlement already delivered. This order's window leaves
     *  both, and the sweep removes the file without resubmitting it. */
    acknowledge: (record, lease) =>
      leased(lease, async () => {
        if (record.sdkPaymentId !== null)
          await addTombstone(directory, record.sdkPaymentId)
        await remove(fileFor(directory, record))
        bump("acknowledged")
      }),

    reject: (record, lease) =>
      leased(lease, async () => {
        await remove(fileFor(directory, record))
        bump("rejected")
        await addLoss(directory, "rejected", 1)
      }),

    unreportedLoss: () => serialise(() => readLoss(directory)),

    settleReportedLoss: (reported, lease) =>
      leased(lease, async () => {
        const loss = await readLoss(directory)
        await writeLoss(directory, {
          expired: Math.max(0, loss.expired - reported.expired),
          evicted: Math.max(0, loss.evicted - reported.evicted),
          rejected: Math.max(0, loss.rejected - reported.rejected),
          parseFailed: Math.max(0, loss.parseFailed - reported.parseFailed),
        })
      }),

    discardAll: () => {
      beginDiscard()
      return serialise(runDiscard)
    },

    retire: () => {
      retiredDirectories.add(directory)
      beginDiscard()
      return serialise(runDiscard)
    },

    hasPendingDiscard: () =>
      serialise(async () => discardOwed.has(directory) || RNFS.exists(tombstonePath)),
  }
}
