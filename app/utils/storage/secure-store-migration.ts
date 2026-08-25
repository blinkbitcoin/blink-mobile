/* eslint-disable camelcase */
import analytics from "@react-native-firebase/analytics"
import type { ACCESSIBLE } from "react-native-keychain"

import { recordAppError } from "@app/utils/error-reporting"
import { withTimeout } from "@app/utils/with-timeout"

import { legacyErase, legacyRead } from "./legacy-key-store"
import {
  type SecureExists,
  type SecureRead,
  secureExists,
  secureRead,
  secureRemove,
  secureWrite,
} from "./secure-store"

/**
 * Lazy, per-slot read-through migration off `react-native-secure-key-store`
 * (blinkbitcoin/blink-wip#1143). No boot-time sweep: a slot moves the first
 * time it is read, and only then.
 *
 * Writes never read through. `set*` writes the new store only.
 *
 * Nothing here ever rejects. Every failure arrives as `failed` or `false`, so a
 * consumer that today swallows a keystore error into `null` keeps working
 * unchanged when it moves over in blinkbitcoin/blink-wip#1161.
 */

const KEY_CLASS_SEPARATOR = ":"

/**
 * `mnemonic:<accountId>` becomes `mnemonic`. Cutting at the first separator is
 * what structurally keeps an account id out of telemetry, out of Crashlytics
 * and out of error messages, rather than trusting each call site to pass a safe
 * label.
 */
const keyClassOf = (key: string): string => key.split(KEY_CLASS_SEPARATOR)[0]

/**
 * The legacy-hit counter. Dropping the legacy dependency
 * (blinkbitcoin/blink-wip#1163) is gated on this going quiet, so it has to
 * exist from the first migrating build or that decision has no evidence behind
 * it. Tagged by key class only, never by value or account id.
 *
 * Deliberately not deduplicated per process: once a slot has migrated the new
 * store answers first and this never fires again, so a repeat is real signal
 * that the migrating write keeps failing.
 *
 * It lives here rather than in `app/utils/analytics.ts` because the storage
 * layer must not take on that module's import graph — `secureStorage.ts` starts
 * depending on this helper in blinkbitcoin/blink-wip#1161, and it is imported
 * from screens.
 */
const logLegacyHit = (legacyKey: string): void => {
  try {
    // Both halves are isolated: the synchronous call by the catch, the promise
    // it returns by its own handler. Migration bookkeeping never costs
    // availability, telemetry included.
    analytics()
      .logEvent("legacy_key_store_hit", { key_class: keyClassOf(legacyKey) })
      .catch(() => {})
  } catch {
    // Firebase not initialised.
  }
}

/**
 * Far beyond any real keychain operation. It is not a latency budget; it exists
 * so that one native call that never settles cannot hold a slot's queue open
 * for the rest of the process.
 */
const SLOT_OPERATION_TIMEOUT_MS = 30_000

/**
 * Per-slot serialization of everything that can move a value between the two
 * stores.
 *
 * A read racing a remove on one slot is not hypothetical: a logout removes the
 * auth token while other callers are still reading it. Unserialized, the read
 * can resolve its legacy value before the remove runs and write it back after,
 * so a logout that reported success leaves the credential readable again. It
 * also collapses two concurrent first reads into a single migration instead of
 * two writes and two erases.
 *
 * Keyed by slot, so unrelated slots never wait on each other, and the entry is
 * dropped once nothing follows it — the map stays bounded by the slots in
 * flight, not by every slot ever touched.
 */
const pendingBySlot = new Map<string, Promise<void>>()

const onSlot = <T>(slot: string, task: () => Promise<T>): Promise<T> => {
  const previous = pendingBySlot.get(slot) ?? Promise.resolve()
  // The timeout cannot cancel a hung native call, but it does let the queue
  // move on, and it lands the caller on the `failed` path the rest of this
  // design is built to handle safely.
  const result = previous.then(() =>
    withTimeout(task(), SLOT_OPERATION_TIMEOUT_MS, `secure store ${keyClassOf(slot)}`),
  )

  // What gets queued is the settled promise, not the result: it absorbs the
  // rejection so that one failed operation cannot cancel the work behind it,
  // while the rejection still reaches its own caller through `result`.
  const settled = result.then(
    () => undefined,
    () => undefined,
  )
  pendingBySlot.set(slot, settled)
  settled.then(() => {
    const isLastInLine = pendingBySlot.get(slot) === settled
    if (isLastInLine) pendingBySlot.delete(slot)
  })

  return result
}

/**
 * Erases the legacy copy and reports whether it is provably gone.
 *
 * The legacy `remove` rejects with code "6" for a key that was never there
 * (ios/RNSecureKeyStore.m `remove:`, whose `deleteKeychainValue` returns NO on
 * `errSecItemNotFound`), so a failed erase is not evidence of anything on its
 * own. Asking what is still readable is what tells a genuine failure apart from
 * a key another read already migrated away.
 *
 * A read that cannot answer counts as not gone. It is the conservative half of
 * a real trade-off, recorded at `runRemove`.
 */
const eraseLegacyCopy = async (legacyKey: string): Promise<boolean> => {
  const erased = await legacyErase(legacyKey)
  if (erased) return true

  const remaining = await legacyRead(legacyKey)
  if (remaining.status === "absent") return true

  const keyClass = keyClassOf(legacyKey)
  recordAppError(new Error(`Legacy key store erase failed: ${keyClass}`), {
    dedupKey: `storage-legacy-erase-failed-${keyClass}`,
  })
  return false
}

export type ReadThroughArgs = {
  /** Slot name in the new store. */
  readonly slot: string
  /** The key this value currently lives under in the legacy store. */
  readonly legacyKey: string
  /** Protection class for the migrating write. */
  readonly accessible: ACCESSIBLE
  /** Whether a successful migration should erase the legacy copy. */
  readonly deleteLegacyOnMigrate: boolean
}

export type RemoveThroughArgs = {
  readonly slot: string
  readonly legacyKey: string
}

const runRead = async (args: ReadThroughArgs): Promise<SecureRead> => {
  const current = await secureRead(args.slot)

  // The steady state after migration: the legacy library is never touched
  // again, which is what keeps its unscoped reinstall wipe from ever firing.
  if (current.status === "found") return current

  // A transient new-store failure must not fall back. The legacy copy may be
  // stale, and falling back would re-enter the legacy library on exactly the
  // path where its wipe is most likely to still be armed.
  if (current.status === "failed") return current

  const legacy = await legacyRead(args.legacyKey)

  // The only path that produces `absent`, which is what keeps a genuine fresh
  // install honest.
  if (legacy.status === "absent") return legacy

  // "Flaky keystore" and "nothing there" are indistinguishable here, and
  // scoring the first as absent is what deletes credentials downstream.
  if (legacy.status === "failed") return legacy

  logLegacyHit(args.legacyKey)

  // A failed write leaves the legacy copy intact and retries on the next read:
  // migration bookkeeping must never cost availability, so the erase outcome is
  // reported inside `eraseLegacyCopy` and never changes what the caller gets.
  const written = await secureWrite(args.slot, legacy.value, args.accessible)
  const shouldEraseLegacy = written && args.deleteLegacyOnMigrate
  if (shouldEraseLegacy) await eraseLegacyCopy(args.legacyKey)

  return legacy
}

const runRemove = async (args: RemoveThroughArgs): Promise<boolean> => {
  // The legacy copy goes first, and a copy that is not provably gone stops the
  // removal there. While the new store still holds the value it answers first,
  // so the survivor stays unreachable; emptying the new store anyway would turn
  // "two copies, one deleted" into "one copy, and it is the stale one".
  //
  // Rejected alternative: carry on when the legacy store cannot say what is
  // left, on the grounds that a copy nobody can read is a copy nobody can
  // resurrect. It buys a completed delete on a permanently broken legacy store,
  // at the price of a silently restored credential the moment that store
  // recovers. Leaving a failed operation with everything where it was is the
  // safer half, and the caller is told so.
  const legacyGone = await eraseLegacyCopy(args.legacyKey)
  if (!legacyGone) return false

  return secureRemove(args.slot)
}

const runExists = async (args: ReadThroughArgs): Promise<SecureExists> => {
  const current = await secureExists(args.slot)
  if (current.status === "yes") return current
  if (current.status === "failed") return current

  const read = await runRead(args)
  if (read.status === "found") return { status: "yes" }
  if (read.status === "absent") return { status: "no" }
  return { status: "failed", err: read.err }
}

/**
 * Reads a slot, migrating it from the legacy store on the way if that is where
 * it still lives.
 *
 * When both stores hold a value the new store wins, unconditionally and without
 * comparing: neither store carries a timestamp, so any other rule is a guess.
 * Returning on the first hit enforces that for free, and it is also what makes
 * an orphaned legacy copy from a failed erase unreachable and harmless — for as
 * long as the new store holds the value, which is what `removeThrough` and the
 * per-slot queue exist to keep true.
 */
export const readThrough = async (args: ReadThroughArgs): Promise<SecureRead> => {
  try {
    return await onSlot(args.slot, () => runRead(args))
  } catch (err) {
    return { status: "failed", err }
  }
}

/**
 * Deletes a slot from both stores.
 *
 * A delete that only reached the new store is not a delete: the next
 * `readThrough` would miss, fall through to the legacy copy and write the old
 * value straight back. That resurrection is why a read-through store cannot
 * have a new-store-only remove.
 *
 * False means the value is not provably gone and the caller must treat the slot
 * as still set — the same contract as the erase primitives it replaces, and a
 * state a retry can act on.
 */
export const removeThrough = async (args: RemoveThroughArgs): Promise<boolean> => {
  try {
    return await onSlot(args.slot, () => runRemove(args))
  } catch {
    return false
  }
}

/**
 * Asks whether a slot is set, without deciding it is not just because the value
 * has yet to migrate.
 *
 * `secureExists` alone answers `no` for every unmigrated slot, which is how a
 * consumer like `getIsPinEnabled` would skip the lock screen for every
 * upgrading user. The probe is still tried first, since it is the only one that
 * answers before first unlock; only when it comes back `no` does this fall
 * through to a full read, which migrates the value as a side effect. By then
 * the slot is unmigrated by definition, so its legacy copy is still readable
 * under the protection class it has today.
 */
export const existsThrough = async (args: ReadThroughArgs): Promise<SecureExists> => {
  try {
    return await onSlot(args.slot, () => runExists(args))
  } catch (err) {
    return { status: "failed", err }
  }
}
