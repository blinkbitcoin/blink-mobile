import AsyncStorage from "@react-native-async-storage/async-storage"
import { recordAppError } from "@app/utils/error-reporting"

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
