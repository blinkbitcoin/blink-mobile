import AsyncStorage from "@react-native-async-storage/async-storage"

import { normalizeMnemonic } from "@app/utils/mnemonic"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const ACCOUNT_INDEX_KEY = "selfCustodialAccountIndex"
const LEGACY_ID_LIST_KEY = "selfCustodialAccountIds"

export type SelfCustodialAccountEntry = {
  id: string
  lightningAddress: string | null
}

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

const readIndex = async (): Promise<SelfCustodialAccountEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_INDEX_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter(isEntry) : []
    }

    // One-shot migration from the legacy id-only list.
    const legacyRaw = await AsyncStorage.getItem(LEGACY_ID_LIST_KEY)
    if (!legacyRaw) return []
    const legacyParsed: unknown = JSON.parse(legacyRaw)
    if (!Array.isArray(legacyParsed)) return []
    const migrated: SelfCustodialAccountEntry[] = legacyParsed
      .filter((id): id is string => typeof id === "string")
      .map((id) => ({ id, lightningAddress: null }))
    await AsyncStorage.setItem(ACCOUNT_INDEX_KEY, JSON.stringify(migrated))
    return migrated
  } catch {
    return []
  }
}

const writeIndex = async (entries: SelfCustodialAccountEntry[]): Promise<void> => {
  await AsyncStorage.setItem(ACCOUNT_INDEX_KEY, JSON.stringify(entries))
}

export const listSelfCustodialAccounts = async (): Promise<SelfCustodialAccountEntry[]> =>
  readIndex()

export const listSelfCustodialAccountIds = async (): Promise<string[]> => {
  const entries = await readIndex()
  return entries.map((e) => e.id)
}

export const addSelfCustodialAccountId = async (id: string): Promise<void> => {
  const entries = await readIndex()
  if (entries.some((e) => e.id === id)) return
  await writeIndex([...entries, { id, lightningAddress: null }])
}

export const removeSelfCustodialAccountId = async (id: string): Promise<void> => {
  const entries = await readIndex()
  const next = entries.filter((e) => e.id !== id)
  if (next.length === entries.length) return
  await writeIndex(next)
}

export const setSelfCustodialLightningAddress = async (
  id: string,
  lightningAddress: string | null,
): Promise<void> => {
  const entries = await readIndex()
  const idx = entries.findIndex((e) => e.id === id)
  if (idx === -1) return
  if (entries[idx].lightningAddress === lightningAddress) return
  const next = [...entries]
  next[idx] = { ...next[idx], lightningAddress }
  await writeIndex(next)
}

export const findSelfCustodialAccountByMnemonic = async (
  mnemonic: string,
): Promise<string | null> => {
  const normalized = normalizeMnemonic(mnemonic)
  const entries = await readIndex()
  for (const entry of entries) {
    const stored = await KeyStoreWrapper.getMnemonicForAccount(entry.id)
    if (stored && normalizeMnemonic(stored) === normalized) return entry.id
  }
  return null
}
