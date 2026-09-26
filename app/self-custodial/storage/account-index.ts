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

const toReadFailed = (err: unknown): ReadIndexResult => {
  const error =
    err instanceof Error ? err : new Error(`Account index read failed: ${err}`)
  // Registry read failures can wipe account bookkeeping; never downgrade them
  // even when the message looks connectivity-shaped ("AsyncStorage unavailable").
  recordAppError(error, { alwaysRecord: true })
  return { status: StorageReadStatus.ReadFailed, error }
}

const readIndex = async (): Promise<ReadIndexResult> => {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_INDEX_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      const entries = Array.isArray(parsed) ? parsed.filter(isEntry) : []
      return { status: StorageReadStatus.Ok, entries }
    }

    // One-shot migration from the legacy id-only list.
    const legacyRaw = await AsyncStorage.getItem(LEGACY_ID_LIST_KEY)
    if (!legacyRaw) return { status: StorageReadStatus.Ok, entries: [] }

    const legacyParsed: unknown = JSON.parse(legacyRaw)
    if (!Array.isArray(legacyParsed)) {
      return { status: StorageReadStatus.Ok, entries: [] }
    }

    const migrated: SelfCustodialAccountEntry[] = legacyParsed
      .filter((id): id is string => typeof id === "string")
      .map((id) => ({ id, lightningAddress: null }))
    await AsyncStorage.setItem(ACCOUNT_INDEX_KEY, JSON.stringify(migrated))

    return { status: StorageReadStatus.Ok, entries: migrated }
  } catch (err) {
    return toReadFailed(err)
  }
}

const writeIndex = async (entries: SelfCustodialAccountEntry[]): Promise<void> => {
  await AsyncStorage.setItem(ACCOUNT_INDEX_KEY, JSON.stringify(entries))
}

export const listSelfCustodialAccounts = async (): Promise<ReadIndexResult> => readIndex()

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

export const addSelfCustodialAccountId = async (id: string): Promise<void> => {
  const result = await readIndex()
  if (result.status === StorageReadStatus.ReadFailed) return
  if (result.entries.some((e) => e.id === id)) return

  await writeIndex([...result.entries, { id, lightningAddress: null }])
}

export const removeSelfCustodialAccountId = async (id: string): Promise<void> => {
  const result = await readIndex()
  if (result.status === StorageReadStatus.ReadFailed) return

  const next = result.entries.filter((e) => e.id !== id)
  if (next.length === result.entries.length) return

  await writeIndex(next)
}

export const setSelfCustodialLightningAddress = async (
  id: string,
  lightningAddress: string | null,
): Promise<void> => {
  const result = await readIndex()
  if (result.status === StorageReadStatus.ReadFailed) return

  const idx = result.entries.findIndex((e) => e.id === id)
  if (idx === -1) return
  if (result.entries[idx].lightningAddress === lightningAddress) return

  const next = [...result.entries]
  next[idx] = { ...next[idx], lightningAddress }
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
type PurgeSkippedReason =
  | "sweep-incomplete"
  | "already-done"
  | "index-unreadable"
  | "retries-exhausted"

type PurgeResult =
  | { status: "done" }
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
 * Migrates the mnemonic of every account in the index, whether or not the user
 * ever opens it.
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
  const result = await readIndex()
  // No index means no enumeration; the next boot reads it again. Reporting zero
  // migrations here would look like a completed sweep over accounts never seen.
  if (result.status === StorageReadStatus.ReadFailed) {
    return { status: "incomplete", failures: 0 }
  }

  let migrated = 0
  let failures = 0

  for (const entry of result.entries) {
    // Per account, so one unreadable slot cannot strand the accounts behind it.
    const mnemonic = await KeyStoreWrapper.mnemonicExists(entry.id)
    if (mnemonic.status === "failed") {
      failures += 1
      // Breadcrumb only, so the cause of each failure survives without every
      // account on a locked device raising its own non-fatal. The sweep being
      // incomplete is the reportable event, and it is raised once below.
      recordAppError(
        mnemonic.err instanceof Error
          ? mnemonic.err
          : new Error(`Mnemonic sweep probe failed: ${mnemonic.err}`),
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
        const landed = await KeyStoreWrapper.mnemonicIsMigrated(entry.id)
        if (landed.status === "yes") {
          // An upgrading install stored its mnemonics before that list existed,
          // so this is the only place they get recorded — and without the
          // record the reinstall wipe has no account to reach. A record that
          // does not land is a failure of the sweep too: the seed is there and
          // the wipe cannot name it, which is the whole point of running this.
          const remembered = await KeyStoreWrapper.rememberMnemonicAccount(entry.id)
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
      await KeyStoreWrapper.mnemonicNetworkExists(entry.id)
    }
  }

  if (failures === 0) return { status: "ok", migrated }

  // One non-fatal for the whole sweep, carrying the share of the index that did
  // not migrate. A key per account would say nothing about how much is left
  // behind, and the dedup below only holds for this process, so the next boot
  // reports the sweep again if it is still incomplete. The ids stay out of both
  // the key and the message, for the reason keyClassOf exists.
  recordAppError(
    new Error(`Mnemonic sweep incomplete: ${failures}/${result.entries.length}`),
    { dedupKey: "storage-mnemonic-sweep-failed" },
  )

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
 * Three outcomes say nothing here. `already-done` is the steady state after the
 * first launch. The other two are already reported by whoever caused them — the
 * sweep raises its own incompleteness, and readIndex records an unreadable index
 * with `alwaysRecord` — so repeating them would double-count the same device and
 * leave this metric measuring someone else's failure.
 *
 * Of what remains, only a store's silence is raised as a defect, deduped per
 * process the way the sweep raises its own. `unmigrated` is not one: an index entry
 * whose key material exists nowhere is an odd device rather than a fault, and
 * raising it would bury the real faults under the noise of every restored phone.
 * `retries-exhausted` is not one either, for the same reason: it is that same state
 * having run out of launches, and it reaches this function only once, so the event
 * carries it without a defect report behind it.
 */
const reportPurgeOutcome = (result: PurgeResult): PurgeResult => {
  const outcome = result.status === "skipped" ? result.reason : result.status

  const isReportedByItsCause =
    outcome === "already-done" ||
    outcome === "sweep-incomplete" ||
    outcome === "index-unreadable"
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
 * Runs only after a sweep that reported every account read. The purge deletes
 * the legacy mnemonic copies, so running it over an incomplete sweep would
 * delete a copy whose value never reached the new store — the one failure mode
 * in this migration that costs someone their funds rather than a re-login.
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
  if (sweep.status !== "ok") {
    return reportPurgeOutcome({ status: "skipped", reason: "sweep-incomplete" })
  }

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

  // Cleared with the flag, so an install that recovers after a few bad launches
  // does not carry a spent bound into a future reinstall — the flag's own
  // lifetime resets there, and a counter that outlived it would let a handful of
  // old failures cancel the next install's first purge. Through the same helper
  // as the other two counter operations, which swallows its own failures.
  await remove(LEGACY_PURGE_ATTEMPTS_KEY)

  // Discarded deliberately: a flag that cannot be written means the purge runs
  // again on the next boot, over a store it has already emptied, which is a
  // wasted pass and nothing worse.
  await saveString(LEGACY_PURGE_DONE_KEY, "true")
  return reportPurgeOutcome({ status: "done" })
}
