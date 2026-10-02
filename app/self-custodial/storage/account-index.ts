import AsyncStorage from "@react-native-async-storage/async-storage"
import analytics from "@react-native-firebase/analytics"

import { recordAppError } from "@app/utils/error-reporting"
import { readString, remove, saveString } from "@app/utils/storage"

import { normalizeMnemonic } from "@app/utils/mnemonic"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const ACCOUNT_INDEX_KEY = "selfCustodialAccountIndex"
const LEGACY_ID_LIST_KEY = "selfCustodialAccountIds"

export type SelfCustodialAccountEntry = {
  id: string
  lightningAddress: string | null
}

export const StorageReadStatus = {
  Ok: "ok",
  ReadFailed: "read-failed",
} as const

export type StorageReadStatus = (typeof StorageReadStatus)[keyof typeof StorageReadStatus]

export type StorageReadFailed = {
  status: typeof StorageReadStatus.ReadFailed
  error: Error
}

export type ReadIndexResult =
  | { status: typeof StorageReadStatus.Ok; entries: SelfCustodialAccountEntry[] }
  | StorageReadFailed

export type FindMnemonicResult =
  | { status: typeof StorageReadStatus.Ok; id: string | null }
  | StorageReadFailed

export type AccountIdsRead =
  | { status: typeof StorageReadStatus.Ok; ids: readonly string[] }
  | StorageReadFailed

const isEntry = (value: unknown): value is SelfCustodialAccountEntry => {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.id !== "string") return false
  if (
    candidate.lightningAddress !== null &&
    typeof candidate.lightningAddress !== "string"
  ) {
    return false
  }
  return true
}

const toReadFailed = (err: unknown): StorageReadFailed => {
  const error =
    err instanceof Error ? err : new Error(`Account index read failed: ${err}`)
  // Registry read failures can wipe account bookkeeping; never downgrade them
  // even when the message looks connectivity-shaped ("AsyncStorage unavailable").
  recordAppError(error, { alwaysRecord: true })
  return { status: StorageReadStatus.ReadFailed, error }
}

/**
 * What the index key holds, both as the accounts a reader can use and as every item it
 * stores, from one read.
 *
 * The two differ only when the index is damaged, and every write starts from the items. A
 * write that started from the accounts alone would store the index back without the
 * entries it could not read, and those entries are the only sign that a mnemonic stood
 * behind them: the sweep names each one that still carries an id, and the strict reader
 * the owed reinstall erase trusts refuses the index while one is there. One lightning
 * address stored from the accounts alone was enough to turn an index the erase refused
 * into a shorter one it trusts, and the seed of the entry left out went with the previous
 * owner's.
 */
type StoredIndex =
  | {
      status: typeof StorageReadStatus.Ok
      entries: SelfCustodialAccountEntry[]
      items: readonly unknown[]
    }
  | StorageReadFailed

/** A value that is not a list is kept as the one item it is, so a write cannot replace
 *  it with a list that no longer shows it. */
const itemsOf = (parsed: unknown): readonly unknown[] =>
  Array.isArray(parsed) ? parsed : [parsed]

const entriesOf = (parsed: unknown): SelfCustodialAccountEntry[] =>
  Array.isArray(parsed) ? parsed.filter(isEntry) : []

const readStoredIndex = async (): Promise<StoredIndex> => {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_INDEX_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      return {
        status: StorageReadStatus.Ok,
        entries: entriesOf(parsed),
        items: itemsOf(parsed),
      }
    }

    // One-shot migration from the legacy id-only list.
    const legacyRaw = await AsyncStorage.getItem(LEGACY_ID_LIST_KEY)
    if (!legacyRaw) return { status: StorageReadStatus.Ok, entries: [], items: [] }

    const legacyParsed: unknown = JSON.parse(legacyRaw)
    if (!Array.isArray(legacyParsed)) {
      return { status: StorageReadStatus.Ok, entries: [], items: itemsOf(legacyParsed) }
    }

    // An item that is not an id is carried over as it is, for the reason above.
    const migrated: unknown[] = legacyParsed.map((item: unknown) =>
      typeof item === "string" ? { id: item, lightningAddress: null } : item,
    )
    await AsyncStorage.setItem(ACCOUNT_INDEX_KEY, JSON.stringify(migrated))

    return { status: StorageReadStatus.Ok, entries: entriesOf(migrated), items: migrated }
  } catch (err) {
    return toReadFailed(err)
  }
}

const readIndex = async (): Promise<ReadIndexResult> => {
  const stored = await readStoredIndex()
  if (stored.status === StorageReadStatus.ReadFailed) return stored
  return { status: StorageReadStatus.Ok, entries: stored.entries }
}

const writeIndex = async (items: readonly unknown[]): Promise<void> => {
  await AsyncStorage.setItem(ACCOUNT_INDEX_KEY, JSON.stringify(items))
}

/** The id an index item names, damaged or not, or null when it carries none. */
const idOfEntry = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null
  const { id } = value as { id?: unknown }
  const isUsableId = typeof id === "string" && id.length > 0
  return isUsableId ? id : null
}

export const listSelfCustodialAccounts = async (): Promise<ReadIndexResult> => readIndex()

/**
 * Every account id the index names, read from the same key `readIndex` would use, or that
 * it cannot say for certain.
 *
 * Strict where `readIndex` degrades. That function keeps an index usable by dropping
 * entries it does not recognise, which is right for a screen listing wallets and wrong for
 * a caller that spares exactly the ids it is handed: an entry dropped there is a wallet
 * whose seed would be erased. So a value that is not wholly a list of accounts is a read
 * that failed, never a shorter list. Read-only, unlike `readIndex`, which also migrates the
 * legacy list it falls back to.
 */
export const readSelfCustodialAccountIds = async (): Promise<AccountIdsRead> => {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_INDEX_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      const isWholeIndex = Array.isArray(parsed) && parsed.every(isEntry)
      if (!isWholeIndex) {
        return toReadFailed(
          new Error("Account index holds entries that are not accounts"),
        )
      }
      return { status: StorageReadStatus.Ok, ids: parsed.map((entry) => entry.id) }
    }

    const legacyRaw = await AsyncStorage.getItem(LEGACY_ID_LIST_KEY)
    if (!legacyRaw) return { status: StorageReadStatus.Ok, ids: [] }

    const legacyParsed: unknown = JSON.parse(legacyRaw)
    const isWholeList =
      Array.isArray(legacyParsed) && legacyParsed.every((id) => typeof id === "string")
    if (!isWholeList) {
      return toReadFailed(
        new Error("Legacy account id list holds values that are not ids"),
      )
    }
    return { status: StorageReadStatus.Ok, ids: legacyParsed }
  } catch (err) {
    return toReadFailed(err)
  }
}

export const StoredWalletPresence = {
  Present: "present",
  Absent: "absent",
  /** The index could not be read, so this device may or may not hold a wallet. */
  Unknown: "unknown",
} as const

export type StoredWalletPresence =
  (typeof StoredWalletPresence)[keyof typeof StoredWalletPresence]

/**
 * Whether this device still holds a self-custodial wallet, with "could not tell" kept as
 * its own answer rather than folded into either of the other two.
 *
 * Two callers ask this and lean opposite ways on an unreadable index, both deliberately: a
 * logout keeps the app lock on an answer it could not get, and a sessionless cold start
 * lands on the landing screen. Sharing a boolean would force one of those biases on the
 * other, so what is shared is the reading, and each caller names its own bias at the point
 * it applies it. That is also what keeps the two from drifting apart as this read changes.
 */
export const readStoredWalletPresence = async (): Promise<StoredWalletPresence> => {
  const wallets = await listSelfCustodialAccounts()
  if (wallets.status === StorageReadStatus.ReadFailed) return StoredWalletPresence.Unknown

  return wallets.entries.length > 0
    ? StoredWalletPresence.Present
    : StoredWalletPresence.Absent
}

export const SelfCustodialIndexPresence = {
  /** Neither index key is stored, which a real reinstall guarantees. */
  Absent: "absent",
  /** Something is stored, so this device is not a fresh install. */
  Present: "present",
  /** The read could not answer, which proves nothing either way. */
  Unknown: "unknown",
} as const

export type SelfCustodialIndexPresence =
  (typeof SelfCustodialIndexPresence)[keyof typeof SelfCustodialIndexPresence]

/**
 * Whether the device still holds an account index, for the reinstall wipe.
 *
 * Three answers rather than two, because collapsing the last one costs
 * something either way. "Present" and "unknown" both hold the erase back, but
 * only "unknown" leaves it owed: the caller keeps that boot from persisting so
 * the next one asks again, which is the retry the erase's own design assumes.
 *
 * Distinct from "the index read as empty": readIndex degrades a stored value it
 * cannot recognise to zero entries, and an erase that cannot be undone must not
 * take that as proof.
 */
export const readSelfCustodialIndexPresence =
  async (): Promise<SelfCustodialIndexPresence> => {
    try {
      const [canonical, legacy] = await Promise.all([
        AsyncStorage.getItem(ACCOUNT_INDEX_KEY),
        AsyncStorage.getItem(LEGACY_ID_LIST_KEY),
      ])
      return canonical === null && legacy === null
        ? SelfCustodialIndexPresence.Absent
        : SelfCustodialIndexPresence.Present
    } catch {
      return SelfCustodialIndexPresence.Unknown
    }
  }

/**
 * Registers an account, and throws when the index cannot be read.
 *
 * Returning quietly there would hand back a wallet that works and that the
 * index does not list. The owed reinstall wipe takes an absent index as proof
 * that every tracked mnemonic belongs to the previous owner, so that wallet's
 * seed would go with them. Both callers undo the mnemonic they stored when this
 * throws.
 */
export const addSelfCustodialAccountId = async (id: string): Promise<void> => {
  const result = await readStoredIndex()
  if (result.status === StorageReadStatus.ReadFailed) throw result.error
  if (result.entries.some((e) => e.id === id)) return

  await writeIndex([...result.items, { id, lightningAddress: null }])
}

/**
 * Drops every item naming the account, a damaged one included: the account's mnemonic is
 * erased with it, so an item left behind would only have the sweep name a seed that is
 * gone.
 */
export const removeSelfCustodialAccountId = async (id: string): Promise<void> => {
  const result = await readStoredIndex()
  if (result.status === StorageReadStatus.ReadFailed) return

  const next = result.items.filter((item) => idOfEntry(item) !== id)
  if (next.length === result.items.length) return

  await writeIndex(next)
}

export const setSelfCustodialLightningAddress = async (
  id: string,
  lightningAddress: string | null,
): Promise<void> => {
  const result = await readStoredIndex()
  if (result.status === StorageReadStatus.ReadFailed) return

  const target = result.entries.find((e) => e.id === id)
  if (!target) return
  if (target.lightningAddress === lightningAddress) return

  const next = result.items.map((item) =>
    item === target ? { ...target, lightningAddress } : item,
  )
  await writeIndex(next)
}

export const findSelfCustodialAccountByMnemonic = async (
  mnemonic: string,
): Promise<FindMnemonicResult> => {
  const result = await readIndex()
  if (result.status === StorageReadStatus.ReadFailed) {
    return { status: StorageReadStatus.ReadFailed, error: result.error }
  }

  const normalized = normalizeMnemonic(mnemonic)
  let unreadableEntries = 0

  for (const entry of result.entries) {
    const stored = await KeyStoreWrapper.readMnemonicWithStatus(entry.id)
    // Counted and carried on past, not returned. Ending the scan on the first
    // entry that will not answer would let one damaged slot fail every restore
    // on the device, including a phrase belonging to an account further down
    // the list that reads perfectly. The trade is a scan that can finish
    // without having looked at everything, which the count above reports; on
    // Android one lock-screen change invalidates the Keystore and fails every
    // entry at once, which is exactly when the written-down phrase is the only
    // way back in.
    if (stored.status === "failed") {
      unreadableEntries += 1
    } else if (
      stored.status === "found" &&
      normalizeMnemonic(stored.value) === normalized
    ) {
      return { status: StorageReadStatus.Ok, id: entry.id }
    }
  }

  // A readable match still wins above. Reaching here with unreadable entries
  // means "no match among the ones that answered", and the caller is told no
  // match: a restore then creates a second account for a seed that may already
  // be on the device. That is the chosen side of the trade — a duplicate can be
  // removed later, a restore that cannot run has no way around it — and the
  // report below is what keeps the cost visible.
  if (unreadableEntries > 0) {
    recordAppError(
      new Error(
        `Mnemonic lookup incomplete: ${unreadableEntries}/${result.entries.length}`,
      ),
      { dedupKey: "storage-mnemonic-lookup-incomplete" },
    )
  }

  return { status: StorageReadStatus.Ok, id: null }
}

/**
 * Deliberately not exported: the sweep reports its own outcome and no caller
 * reads this, so exporting it would advertise a contract nothing honours.
 */
type SweepResult =
  | { status: "ok"; migrated: number }
  | { status: "incomplete"; failures: number }

/** Deliberately not exported, like SweepResult above: the boot path awaits the
 *  purge for its side effects and the reporting happens in here. */
type PurgeSkippedReason = "already-done" | "index-unreadable" | "retries-exhausted"

type PurgeResult =
  | { status: "done" }
  /** Every named key is gone, but the sweep left an account unconfirmed, so the
   *  done-flag is withheld and the next launch runs the pass again. */
  | { status: "sweep-incomplete" }
  /** A store could not answer, so the next boot is worth spending. */
  | { status: "incomplete" }
  /** Every store answered and a mnemonic is not in the new one, which no later
   *  boot changes on its own. */
  | { status: "unmigrated" }
  | { status: "skipped"; reason: PurgeSkippedReason }

/**
 * Upper bound on how long the sweep may wait for an idle window before it runs
 * anyway. Exported so the bound and the thing it bounds are read together: an
 * idle callback with no timeout can be starved for a whole launch on a busy
 * boot, and a launch that never sweeps is a launch whose mnemonics never move.
 */
export const SWEEP_IDLE_TIMEOUT_MS = 5000

/**
 * What a failed probe was, without what it said: a keychain error can carry the server
 * string, which ends in the account id, the reason the other readers of these slots drop
 * the cause too. The kind and the code survive, and they are what tells a locked device
 * from a broken one.
 */
const describeProbeFailure = (err: unknown): string => {
  if (!(err instanceof Error)) return typeof err
  const { code } = err as { code?: unknown }
  return code === undefined ? err.name : `${err.name} ${String(code)}`
}

/**
 * Every account id the index names, and how many of its items name none.
 *
 * Not readIndex's list, which leaves out an entry it cannot read as an account. One that
 * is damaged but still carries an id is named all the same, since a seed may stand behind
 * it that nothing but the sweep would ever move or record. An item with no id is
 * something nothing can name.
 */
type IndexNames =
  | {
      readonly status: typeof StorageReadStatus.Ok
      readonly ids: string[]
      readonly unnameableItems: number
    }
  | StorageReadFailed

const readIndexNames = async (): Promise<IndexNames> => {
  const stored = await readStoredIndex()
  if (stored.status === StorageReadStatus.ReadFailed) return stored

  const named = stored.items.map(idOfEntry)
  const ids = named.filter((id): id is string => id !== null)
  return {
    status: StorageReadStatus.Ok,
    ids: [...new Set(ids)],
    unnameableItems: named.length - ids.length,
  }
}

/**
 * Migrates the mnemonic of every account in the index, whether or not the user
 * ever opens it.
 *
 * Every id the index holds, a damaged entry's included, rather than the accounts a
 * screen can list: an entry that does not read as an account still stands for a seed,
 * and nothing else would ever move or record it. An item that carries no id counts as
 * an account the sweep could not reach, so it never reports itself finished over one.
 *
 * The read-through alone moves a value when something reads it, so an account
 * left untouched between this release and the one that drops the legacy store
 * would never migrate, and its mnemonic would become unreachable at that point.
 * The index survives upgrades, so the accounts can be enumerated and there is no
 * reason to leave that to chance.
 *
 * Migration is the side effect of the probe: no new write path exists here, and
 * a value already in the new store is answered from there without touching the
 * legacy one. Safe to run repeatedly and alongside the lazy path, which is what
 * lets a failure simply be retried on the next boot.
 *
 * It runs on every launch and has no completion marker, which is deliberate: it
 * is also what re-records an account whose tracking write failed or was reset,
 * so retiring it early would leave those unreachable by the reinstall wipe. It
 * retires with the legacy store itself (blinkbitcoin/blink-wip#1163), after
 * which there is nothing left to migrate.
 *
 * It asks whether each mnemonic exists rather than reading it. A read answers by
 * putting the phrase into a JS string, which cannot be zeroed, for every indexed
 * account on every launch — including accounts the user never opens, whose seeds
 * had no reason to enter memory at all. The existence probe also answers before
 * the device's first unlock, where a read returns `errSecInteractionNotAllowed`
 * and would score every account on the device as a failure.
 */
export const sweepMnemonicMigration = async (): Promise<SweepResult> => {
  const names = await readIndexNames()
  // No index means no enumeration; the next boot reads it again. Reporting zero
  // migrations here would look like a completed sweep over accounts never seen.
  if (names.status === StorageReadStatus.ReadFailed) {
    return { status: "incomplete", failures: 0 }
  }

  let migrated = 0
  let failures = names.unnameableItems

  for (const id of names.ids) {
    // Per account, so one unreadable slot cannot strand the accounts behind it.
    const mnemonic = await KeyStoreWrapper.mnemonicExists(id)
    if (mnemonic.status === "failed") {
      failures += 1
      // Breadcrumb only, so the cause of each failure survives without every
      // account on a locked device raising its own non-fatal. The sweep being
      // incomplete is the reportable event, and it is raised once below.
      recordAppError(
        new Error(`Mnemonic sweep probe failed: ${describeProbeFailure(mnemonic.err)}`),
        { expected: true },
      )
    } else {
      if (mnemonic.status === "yes") {
        // "Found" is not "moved". The probe answers yes for a value it read out
        // of the legacy store even when the write meant to migrate it failed —
        // deliberate there, since bookkeeping must never cost availability, but
        // it means a device whose keychain refuses every write would otherwise
        // report a finished migration while nothing had moved. The release that
        // drops the legacy store is gated on this count, so it asks again,
        // without the fallback.
        const landed = await KeyStoreWrapper.mnemonicIsMigrated(id)
        if (landed.status === "yes") {
          // The write that put the mnemonic there records the account first, so
          // this is the repair for a record that did not land or was lost
          // since: without it the reinstall wipe has no account to reach. A
          // record that does not land here is a failure of the sweep too: the
          // seed is there and the wipe cannot name it, which is the whole point
          // of running this.
          const remembered = await KeyStoreWrapper.rememberMnemonicAccount(id)
          if (remembered) {
            migrated += 1
          } else {
            failures += 1
          }
        } else {
          failures += 1
        }
      }
      // The network marker rides along: probed for its side effect only, and an
      // account with no marker is not a failure.
      await KeyStoreWrapper.mnemonicNetworkExists(id)
    }
  }

  if (failures === 0) return { status: "ok", migrated }

  // One non-fatal for the whole sweep, carrying the share of the index that did
  // not migrate. A key per account would say nothing about how much is left
  // behind, and the dedup below only holds for this process, so the next boot
  // reports the sweep again if it is still incomplete. The ids stay out of both
  // the key and the message, for the reason keyClassOf exists.
  const indexedCount = names.ids.length + names.unnameableItems
  recordAppError(new Error(`Mnemonic sweep incomplete: ${failures}/${indexedCount}`), {
    dedupKey: "storage-mnemonic-sweep-failed",
  })

  return { status: "incomplete", failures }
}

const LEGACY_PURGE_DONE_KEY = "legacyKeyStorePurged"
const LEGACY_PURGE_ATTEMPTS_KEY = "legacyKeyStorePurgeAttempts"

/**
 * How many launches may end `unmigrated` before the purge stops trying.
 *
 * That state never resolves on its own: an index entry whose mnemonic exists in
 * neither store. Nothing is there to erase and no later launch changes that, but
 * the purge would still pay a keychain round trip per slot every launch.
 *
 * Two states reach it. A seed in neither store is **Android only**, by
 * construction: that verdict needs a legacy store that can tell a missing key from
 * a failed lookup, and only Android's can (see purgeThrough). So a restored iOS device
 * with an index entry whose key material did not come with it keeps paying the pass
 * every launch and reports `incomplete` each time. That cost is accepted, because
 * the alternative is retiring the purge on an answer iOS cannot stand behind.
 *
 * A damaged MNEMONIC_ACCOUNTS value reaches it on **both** platforms. Nothing read
 * it wrong there: it was read, and what it holds is not a list of ids, which no
 * later launch repairs.
 *
 * Bounded rather than relaxed. The strict rule is what stops an erase on weak
 * evidence, which is worth more than a purge that always reaches done, and the
 * bound is what stops that strictness from costing every later boot.
 *
 * **`unreadable` is deliberately not counted here.** A store that could not answer
 * this boot can answer the next one, and a few silent-push launches on a locked
 * device would otherwise retire the purge for good — leaving the legacy PIN, auth
 * token, profiles and every mnemonic copy in place with nothing left to clear
 * them. A transient failure must cost another attempt, never the last one.
 */
const LEGACY_PURGE_MAX_ATTEMPTS = 5

/**
 * Isolated exactly like logLegacyHit in secure-store-migration, and for the same
 * reason: this runs on the boot path, and migration bookkeeping never costs
 * availability. Kept local rather than added to utils/analytics, whose loggers
 * are unisolated by convention.
 */
const logPurgeOutcome = (outcome: string): void => {
  try {
    analytics()
      .logEvent("legacy_key_store_purge", { outcome })
      .catch(() => {})
  } catch {
    // Firebase not initialised.
  }
}

/**
 * The purge's only field signal. Without it an install stuck short of done is
 * indistinguishable from one that finished on its first launch, and the release
 * that drops the dependency has nothing to gate on but an argument.
 *
 * Two outcomes say nothing here. `already-done` is the steady state after the
 * first launch. `index-unreadable` is already reported by readIndex, which records
 * it with `alwaysRecord`, so repeating it would double-count the same device and
 * leave this metric measuring someone else's failure.
 *
 * Of what remains, only a store's silence is raised as a defect, deduped per
 * process the way the sweep raises its own. `unmigrated` is not one: an index entry
 * whose key material exists nowhere is an odd device rather than a fault, and
 * raising it would bury the real faults under the noise of every restored phone.
 * `retries-exhausted` is not one either, for the same reason: it is that same state
 * having run out of launches, and it reaches this function only once, so the event
 * carries it without a defect report behind it. `sweep-incomplete` is not one
 * either: the sweep already raised the account it could not confirm, and the pass
 * itself left nothing behind. It is still counted, because a pass that finishes
 * and cannot record itself is the purge's own outcome, and the release that drops
 * the dependency has to tell that install from one that never launched.
 */
const reportPurgeOutcome = (result: PurgeResult): PurgeResult => {
  const outcome = result.status === "skipped" ? result.reason : result.status

  const isReportedByItsCause =
    outcome === "already-done" || outcome === "index-unreadable"
  if (isReportedByItsCause) return result

  logPurgeOutcome(outcome)

  const isCausedBySilence = outcome === "incomplete"
  if (isCausedBySilence) {
    // No ids and no key names, for the reason keyClassOf exists: the outcome is
    // the whole payload this report is allowed to carry.
    recordAppError(new Error(`Legacy key store purge ${outcome}`), {
      dedupKey: `storage-legacy-purge-${outcome}`,
    })
  }

  return result
}

/**
 * Zero when the counter cannot be read or holds something that is not a count.
 *
 * Treating an unreadable counter as exhausted would stop a purge that may never
 * have run, which is the failure that costs something: the bound exists to save
 * round trips, not to end the purge early.
 */
const readPurgeAttempts = async (): Promise<number> => {
  const stored = await readString(LEGACY_PURGE_ATTEMPTS_KEY)
  if (stored.status !== "found") return 0

  const parsed = Number.parseInt(stored.value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0

  return parsed
}

/**
 * Erases everything this app left in the legacy key store, once per install.
 *
 * The pass runs whatever the sweep reported. The six session slots have fixed
 * keys and need nothing from it, and purgeThrough proves each mnemonic reached
 * the new store before its legacy copy is erased, so an account the sweep could
 * not read cannot cost a seed here. Gating the whole pass on the sweep would
 * leave the legacy PIN, token and profiles in place for good on a device with
 * one Keystore entry a lock-screen change invalidated, and say nothing about it.
 *
 * What the sweep gates is the done-flag. The flag says the migration is finished
 * for this install, and the sweep is what confirms every account was read, moved
 * and recorded, so a pass that finishes over an incomplete sweep is reported as
 * such and runs again next launch.
 *
 * The done-flag lives in AsyncStorage, which a reinstall clears. That is the
 * right lifetime: after a reinstall the legacy store can still hold items that
 * survived it, so the purge should run again rather than believe a flag from an
 * install that is gone.
 *
 * The flag is set only on a purge that proved every key gone. A partial purge
 * leaves it unset and runs again on the next boot, bounded by
 * LEGACY_PURGE_MAX_ATTEMPTS so a state that never resolves stops costing every
 * launch, and reported through reportPurgeOutcome so an install that never
 * finishes is visible to the release that drops the dependency.
 */
export const purgeLegacyKeyStoreOnce = async (
  sweep: SweepResult,
): Promise<PurgeResult> => {
  const done = await readString(LEGACY_PURGE_DONE_KEY)
  // A flag that cannot be read is not a flag that is unset: purging again is
  // harmless, so the safe reading is to go ahead rather than skip.
  if (done.status === "found") {
    return reportPurgeOutcome({ status: "skipped", reason: "already-done" })
  }

  const attempts = await readPurgeAttempts()
  // Silent: the launch that reached the bound reported it, and this state cannot
  // change on its own, so repeating it every launch forever would say nothing new
  // about the very devices whose outcome was kept quiet to avoid that noise.
  if (attempts >= LEGACY_PURGE_MAX_ATTEMPTS) {
    return { status: "skipped", reason: "retries-exhausted" }
  }

  const result = await readIndex()
  // Without the index the per-account keys cannot be named, and a purge that
  // skips them would still record itself as done.
  if (result.status === StorageReadStatus.ReadFailed) {
    return reportPurgeOutcome({ status: "skipped", reason: "index-unreadable" })
  }

  const accountIds = result.entries.map((entry) => entry.id)
  const purged = await KeyStoreWrapper.purgeLegacyKeyStore(accountIds)

  // Uncounted on purpose: see LEGACY_PURGE_MAX_ATTEMPTS. A store that could not
  // answer, or a migrating write that failed, gets every later launch it needs.
  if (purged === "transient") {
    return reportPurgeOutcome({ status: "incomplete" })
  }

  if (purged === "permanent") {
    // Counted before the report, so the bound advances on a launch whose report
    // is deduped away. Result discarded like the flag below: a counter that
    // cannot be written costs another attempt, not correctness.
    const attempted = attempts + 1
    await saveString(LEGACY_PURGE_ATTEMPTS_KEY, String(attempted))

    // Reported here rather than on the launches that skip, so an install that has
    // given up says so when it happens instead of on every launch after.
    //
    // "When it happens" is the intent, not a guarantee. The counter is
    // read-modify-written without a lock, so two passes in one boot can share an
    // attempt; and a device that can read the counter but not write it reaches the
    // bound on every launch and reports each one. Both are tolerable: the bound is
    // there to stop spending round trips, and a lock or a retry around an
    // AsyncStorage counter would cost more than either case does.
    const isExhausted = attempted >= LEGACY_PURGE_MAX_ATTEMPTS
    if (isExhausted) {
      return reportPurgeOutcome({ status: "skipped", reason: "retries-exhausted" })
    }

    return reportPurgeOutcome({ status: "unmigrated" })
  }

  // Cleared once the pass leaves nothing behind, whether or not the flag follows:
  // the bound charges for the state the pass just resolved, and a counter that
  // outlived it would let a handful of old failures cancel a later purge — the
  // flag's own lifetime resets at a reinstall, and so does this. Through the same
  // helper as the other two counter operations, which swallows its own failures.
  await remove(LEGACY_PURGE_ATTEMPTS_KEY)

  // The sweep's verdict gates the flag, not the pass: every key this launch could
  // name is gone, but an account the sweep could not
  // confirm is not one the migration may call finished. Reported as its own
  // outcome, so the release decision can count the installs stuck here.
  if (sweep.status !== "ok") {
    return reportPurgeOutcome({ status: "sweep-incomplete" })
  }

  // Discarded deliberately: a flag that cannot be written means the purge runs
  // again on the next boot, over a store it has already emptied, which is a
  // wasted pass and nothing worse.
  await saveString(LEGACY_PURGE_DONE_KEY, "true")
  return reportPurgeOutcome({ status: "done" })
}
