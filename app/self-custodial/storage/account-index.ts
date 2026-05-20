import AsyncStorage from "@react-native-async-storage/async-storage"
import crashlytics from "@react-native-firebase/crashlytics"

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
  crashlytics().recordError(error)
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
    const stored = await KeyStoreWrapper.getMnemonicForAccount(entry.id)
    if (stored && normalizeMnemonic(stored) === normalized) {
      return { status: StorageReadStatus.Ok, id: entry.id }
    }
  }

  return { status: StorageReadStatus.Ok, id: null }
}
