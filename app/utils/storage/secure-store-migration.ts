/* eslint-disable camelcase */
import { Platform } from "react-native"

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
 * What the purge waits, in place of the default above.
 *
 * The default is right for work whose caller has nowhere else to go: better a
 * long wait than a failure. The purge is the opposite. It shares three slots with
 * the lock screen (`PIN`, `pinFailureState`, `pinAttempts`) and runs in the same
 * few seconds of boot, so a native call of its own that hangs would leave the
 * user's PIN entry queued behind it. Giving up costs the purge nothing: every
 * slot it abandons is named again on the next launch.
 */
export const PURGE_SLOT_TIMEOUT_MS = 3_000

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

/**
 * Passed to every queued task so it can ask whether it still holds the slot.
 *
 * The timeout cannot cancel a hung native call — `withTimeout` only races it —
 * so an abandoned task keeps running and its continuation still fires. Freeing
 * the queue while that task is alive is what makes the two overlap: the task
 * has to stop mutating on its own, and this is how it is told to.
 *
 * Every side effect that follows an `await` inside a task is guarded by it.
 * Unguarded, a read that hangs past the timeout and resolves after a logout has
 * emptied the slot writes the legacy value it was mid-migration back into the
 * new store, restoring the credential the logout just removed.
 */
type IsCurrent = () => boolean

/**
 * Exported for the one caller that needs the queue without the migration: the
 * mnemonic account list is read-modify-written as a whole in `secureStorage.ts`
 * and has no legacy copy to read through. Taking its turn here is what makes
 * that transaction atomic against every other one on the same slot.
 *
 * Never call it from inside a task already holding the same slot — the inner
 * call would wait on the outer one and neither would ever finish.
 *
 * `timeoutMs` is for the one caller that shares slots with the unlock path and
 * would rather give up than hold them: see PURGE_SLOT_TIMEOUT_MS. Everything else
 * takes the default.
 */
export const onSlot = <T>(
  slot: string,
  task: (isCurrent: IsCurrent) => Promise<T>,
  timeoutMs: number = SLOT_OPERATION_TIMEOUT_MS,
): Promise<T> => {
  const previous = pendingBySlot.get(slot) ?? Promise.resolve()
  const result = previous.then(() => {
    // Scoped to this operation, so it is collected with the closure rather than
    // living in a map that has to be pruned. Pruning is the hazard here: a
    // reset counter would hand a still-running abandoned task its slot back.
    let isAbandoned = false
    const running = task(() => !isAbandoned)

    return withTimeout(running, timeoutMs, `secure store ${keyClassOf(slot)}`).catch(
      (err) => {
        // Reached on timeout, where the task is still running and must stop, and
        // on a task that rejected, where the flag is set on work already over.
        isAbandoned = true
        throw err
      },
    )
  })

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
 *
 * Exported for the one-shot purge, which erases legacy copies the read path is
 * no longer allowed to reach and needs the same proof of absence to decide
 * whether it may record itself as done.
 */
export const eraseLegacyCopy = async (legacyKey: string): Promise<boolean> => {
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

export type WriteThroughArgs = {
  readonly slot: string
  readonly value: string
  readonly accessible: ACCESSIBLE
}

/**
 * The answer an abandoned task gives instead of its real one. It is not
 * normally observed — the caller was handed a timeout the moment the slot was
 * taken away — but `failed` is the only honest value left: the slot moved on,
 * so whatever this task read no longer describes it. Reporting the value it was
 * holding would be reporting a credential that may since have been deleted.
 */
const abandoned = (slot: string): { status: "failed"; err: unknown } => ({
  status: "failed",
  err: new Error(`secure store ${keyClassOf(slot)} operation was abandoned`),
})

const runRead = async (
  args: ReadThroughArgs,
  isCurrent: IsCurrent,
): Promise<SecureRead> => {
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

  // Both stores have answered, so the slot may have changed hands while they
  // did. Everything above this line only reads; everything below it writes.
  if (!isCurrent()) return abandoned(args.slot)

  logLegacyHit(args.legacyKey)

  // A failed write leaves the legacy copy intact and retries on the next read:
  // migration bookkeeping must never cost availability, so the erase outcome is
  // reported inside `eraseLegacyCopy` and never changes what the caller gets.
  const written = await secureWrite(args.slot, legacy.value, args.accessible)
  // Re-checked because the write is itself an await: a slot handed over while
  // it was in flight leaves this erase as the one side effect still ahead. An
  // unerased legacy copy is the harmless outcome — the new store answers first,
  // so it stays unreachable, and the next `removeThrough` clears it.
  const shouldEraseLegacy = written && args.deleteLegacyOnMigrate && isCurrent()
  if (shouldEraseLegacy) await eraseLegacyCopy(args.legacyKey)

  return legacy
}

const runRemove = async (
  args: RemoveThroughArgs,
  isCurrent: IsCurrent,
): Promise<boolean> => {
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

  // The mirror of the read guard: emptying the new store after the slot has
  // moved on deletes whatever took this value's place. `false` is already the
  // contract for "not provably gone", so the caller keeps treating it as set.
  if (!isCurrent()) return false

  return secureRemove(args.slot)
}

const runExists = async (
  args: ReadThroughArgs,
  isCurrent: IsCurrent,
): Promise<SecureExists> => {
  const current = await secureExists(args.slot)
  if (current.status === "yes") return current
  if (current.status === "failed") return current

  const read = await runRead(args, isCurrent)
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
    return await onSlot(args.slot, (isCurrent) => runRead(args, isCurrent))
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
    return await onSlot(args.slot, (isCurrent) => runRemove(args, isCurrent))
  } catch {
    return false
  }
}

/**
 * Writes a slot, taking its turn in the same per-slot queue as the reads and
 * removes.
 *
 * The write still never reads through: it touches the new store only. What the
 * queue buys is order. Unserialized, a read-through migration that has already
 * fetched the legacy value lands its stale write on top of a newer one — a
 * rotated token replaced by the one it rotated away from — and a write still in
 * flight completes after a remove and brings the credential back. Both are the
 * resurrection `removeThrough` exists to prevent, arriving through the one door
 * that was not queued.
 */
export const writeThrough = async (args: WriteThroughArgs): Promise<boolean> => {
  try {
    return await onSlot(args.slot, () =>
      secureWrite(args.slot, args.value, args.accessible),
    )
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
export const existsThrough = async (
  args: ReadThroughArgs,
  timeoutMs?: number,
): Promise<SecureExists> => {
  try {
    return await onSlot(args.slot, (isCurrent) => runExists(args, isCurrent), timeoutMs)
  } catch (err) {
    return { status: "failed", err }
  }
}

/**
 * Why a legacy copy is still there, split by whether a later launch could change
 * the answer. Carries a whole pass as well as a single slot, worst outcome
 * winning: `transient` beats `permanent`, because a pass with anything still worth
 * retrying is worth retrying.
 *
 * `transient` covers everything a store's silence or a failed write caused. Those
 * clear themselves, so they must never count against a retry bound: a keychain
 * that cannot answer for a few launches would otherwise retire the purge and
 * leave every legacy copy in place for good.
 *
 * `permanent` is the state no later launch resolves: every store answered, and
 * the value is in none of them. An index entry can outlive its key material that
 * way, and retrying it is spend with no upside.
 */
export type SlotPurge = "gone" | "transient" | "permanent"

/** One option, named rather than positional: `purgeThrough(args, true)` at a call
 *  site says nothing about which rule it is asking for. */
export type PurgeThroughOptions = {
  /**
   * Whether the new store has to hold the value before an empty legacy read
   * counts as nothing left to erase. True for the seed, where being wrong costs
   * someone their money; false where it costs a re-login.
   */
  requireMigrated: boolean
}

/**
 * Finishes a slot's migration and then erases its legacy copy, in that order.
 *
 * Erasing first is what the obvious implementation does and it is wrong. A
 * read-through reports `found` for a value it read out of the legacy store
 * even when the migrating write failed, so "this slot has been read" is not
 * evidence the new store holds anything. Erasing on that evidence deletes the
 * only copy — a re-login for a session slot, and someone's seed for a
 * mnemonic.
 *
 * So the new store has to say `found` itself before anything is deleted, and
 * every step runs inside the slot queue: a read-through migrating this same
 * slot concurrently sits between its own miss and its legacy read, and an
 * unqueued erase in that window takes the value out from under it.
 *
 * Anything but `gone` leaves the copy for the next boot, split by whether a
 * later boot could answer differently. Only the caller can act on that
 * difference, and it decides both what gets reported and what a retry bound is
 * allowed to charge for.
 *
 * Never rejects, like every other operation on this queue: a slot that timed
 * out must cost its own key and not the ones behind it, which a rejection
 * propagating out of the loop would.
 */
export const purgeThrough = async (
  args: ReadThroughArgs,
  { requireMigrated }: PurgeThroughOptions,
): Promise<SlotPurge> => {
  // Probed rather than read. The probe still migrates when the value is only in
  // the legacy store, which is the last chance this slot gets before its legacy
  // copy is gone, but a slot the sweep already moved answers from the new store
  // without its value leaving the keychain — the reason sweepMnemonicMigration
  // probes rather than reads.
  //
  // A seed does enter memory below, where the erase or the done-flag needs proof
  // that the value survived the move. That read is the price of not deleting the
  // last readable copy, and it is paid on every launch the purge runs, not once:
  // the pass has no per-slot marker, so a slot that already finished is proved
  // again while any other slot keeps the pass short of done. On iOS that can be
  // every launch, since no verdict there is terminal. Closing it means choosing
  // between a legacy copy left behind and key material in memory, which is the
  // trade the two reviews on blinkbitcoin/blink-mobile#4238 disagreed about.
  await existsThrough(args, PURGE_SLOT_TIMEOUT_MS)

  try {
    return await onSlot(
      args.slot,
      async (isCurrent) => {
        const legacy = await legacyRead(args.legacyKey)
        if (legacy.status === "failed") return "transient"

        // `absent` is not proof the legacy store is empty. The iOS module
        // discards the OSStatus and rejects every failed lookup with the
        // not-found code, so a lookup that merely failed is indistinguishable
        // from one that found nothing.
        //
        // Nothing is erased on this path, so the question is only whether to keep
        // asking. A session slot stops: a user who never set a PIN has nothing
        // here and must not be retried forever, and the copy a lying read leaves
        // behind costs a re-login. A mnemonic keeps its strict rule, because
        // getting that wrong costs someone their seed — and when both stores agree
        // the value is nowhere, no later boot changes that.
        if (legacy.status === "absent") {
          if (!requireMigrated) return "gone"

          // Probed before it is read. The probe cannot say whether the value is
          // recoverable — on Android `hasInternetCredentials` resolves true for an
          // entry it never decrypts — but it is the cheap way to learn that there
          // is nothing here to confirm, which is the answer on every slot of a
          // device in this state. The purge names every account on every launch
          // until it completes, and reading on all of them would put every seed
          // into a JS string that cannot be zeroed.
          const present = await secureExists(args.slot)
          if (present.status === "failed") return "transient"

          if (present.status === "yes") {
            // `gone` here is what lets the caller record the purge as finished, so
            // the proof has to be a read that returns the value. A locked iOS
            // launch answers the probe from an item it cannot decrypt while
            // legacyRead lies `absent` for the legacy copy, and believing both
            // would write the done-flag over a seed still sitting in the legacy
            // store, with no later launch to look again.
            const migrated = await secureRead(args.slot)
            return migrated.status === "found" ? "gone" : "transient"
          }

          // Both stores say the seed is nowhere. Terminal only where the legacy
          // store can tell a missing key from a failed lookup: the iOS module
          // rejects every failure with the not-found code, so legacyRead reports
          // `absent` for both there (see its isKeyNotFound branch). Calling that
          // permanent would let a handful of unlucky launches retire the purge and
          // strand a seed in the legacy store for good. Android distinguishes the
          // two, so the verdict is trustworthy and the retry bound gets the
          // terminal state it exists for; iOS keeps retrying, which costs round
          // trips off the boot path and never costs a seed.
          return Platform.OS === "android" ? "permanent" : "transient"
        }

        // There is a legacy copy to erase, so the probe is no longer enough.
        //
        // On Android `hasInternetCredentials` resolves true for an entry that
        // exists without decrypting it (KeychainModule.hasInternetCredentialsForOptions),
        // so a Keystore key invalidated by a lock-screen change — the failure
        // findSelfCustodialAccountByMnemonic already plans around — answers `yes`
        // for a value nothing can read. Erasing the legacy copy on that answer
        // destroys the last readable seed. Only a read that returns the value
        // proves it survived the move, and it happens here, on the one launch
        // that erases, rather than on every launch for every account.
        const migrated = await secureRead(args.slot)

        // `absent` means the migrating write failed and `failed` means the store
        // could not say. Both keep the legacy copy, and both clear themselves.
        if (migrated.status !== "found") return "transient"

        // The queue handed this slot to someone else while it was held, so the
        // proof above describes a state that may already have moved on.
        if (!isCurrent()) return "transient"

        return (await eraseLegacyCopy(args.legacyKey)) ? "gone" : "transient"
      },
      PURGE_SLOT_TIMEOUT_MS,
    )
  } catch {
    return "transient"
  }
}
