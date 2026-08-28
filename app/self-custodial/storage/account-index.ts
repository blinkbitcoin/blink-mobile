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
  for (const entry of result.entries) {
    const stored = await KeyStoreWrapper.readMnemonicWithStatus(entry.id)
    // A read that could not answer is not "this is a different account". Scored
    // that way, a restore of a wallet already on the device reports no match and
    // the caller creates a second account for the same seed.
    if (stored.status === "failed") {
      const error =
        stored.err instanceof Error
          ? stored.err
          : new Error(`Mnemonic read failed: ${stored.err}`)
      return { status: StorageReadStatus.ReadFailed, error }
    }
    if (stored.status === "found" && normalizeMnemonic(stored.value) === normalized) {
      return { status: StorageReadStatus.Ok, id: entry.id }
    }
  }

  return { status: StorageReadStatus.Ok, id: null }
}

export type SweepResult =
  | { status: "ok"; migrated: number }
  | { status: "incomplete"; failures: number }

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
 * Migration is the side effect of the read: no new write path exists here, and
 * a value already in the new store is answered from there without touching the
 * legacy one. Safe to run repeatedly and alongside the lazy path, which is what
 * lets a failure simply be retried on the next boot.
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
    const mnemonic = await KeyStoreWrapper.readMnemonicWithStatus(entry.id)
    if (mnemonic.status === "failed") {
      failures += 1
      recordAppError(
        mnemonic.err instanceof Error
          ? mnemonic.err
          : new Error(`Mnemonic sweep read failed: ${mnemonic.err}`),
        { dedupKey: "storage-mnemonic-sweep-failed" },
      )
    } else {
      if (mnemonic.status === "found") {
        migrated += 1
        // An upgrading install stored its mnemonics before that list existed,
        // so this is the only place they get recorded — and without the record
        // the reinstall wipe has no account to reach.
        await KeyStoreWrapper.rememberMnemonicAccount(entry.id)
      }
      // The network marker rides along: it is read for its side effect only,
      // and an account with no marker is not a failure.
      await KeyStoreWrapper.getMnemonicNetworkForAccount(entry.id)
    }
  }

  return failures > 0 ? { status: "incomplete", failures } : { status: "ok", migrated }
}
