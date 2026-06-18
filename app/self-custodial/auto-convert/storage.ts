import AsyncStorage from "@react-native-async-storage/async-storage"

import { reportError } from "@app/utils/error-logging"

import type { AutoConvertPairing, PendingAutoConvert } from "./types"

const PENDING_STORAGE_KEY = "selfCustodialAutoConvertPending"
const PAIRINGS_STORAGE_KEY = "selfCustodialAutoConvertPairings"

/** Exceeds the default 12h Bolt11 expiry so invoices aren't dropped early. */
const RECORD_TTL_MS = 24 * 60 * 60 * 1000

/** Long enough for orphan replays; bounded so the persisted set stays small. */
const PAIRING_TTL_MS = 7 * 24 * 60 * 60 * 1000

const readAll = async (): Promise<PendingAutoConvert[]> => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isPendingAutoConvert).map(normalizeRecord)
  } catch (err) {
    reportError("auto-convert-storage readAll", err)
    return []
  }
}

const writeAll = async (records: PendingAutoConvert[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(records))
  } catch (err) {
    reportError("auto-convert-storage writeAll", err)
  }
}

// Serialize read-modify-write operations so concurrent callers don't
// clobber each other's updates. A single-slot chain is enough here:
// writes are infrequent and AsyncStorage is already async.
let writeQueue: Promise<void> = Promise.resolve()

const withWriteLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = writeQueue.then(() => fn())
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

const isPendingAutoConvert = (value: unknown): value is PendingAutoConvert => {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.paymentRequest !== "string") return false
  if (typeof candidate.createdAtMs !== "number") return false
  const { amountSats } = candidate
  if (amountSats !== undefined && typeof amountSats !== "number") return false
  // Schema-widening fields default for records persisted before they existed.
  if (candidate.attempts !== undefined && typeof candidate.attempts !== "number") {
    return false
  }
  if (
    candidate.lastAttemptAtMs !== undefined &&
    typeof candidate.lastAttemptAtMs !== "number"
  ) {
    return false
  }
  return true
}

const normalizeRecord = (record: PendingAutoConvert): PendingAutoConvert => ({
  paymentRequest: record.paymentRequest,
  amountSats: record.amountSats,
  createdAtMs: record.createdAtMs,
  attempts: record.attempts ?? 0,
  lastAttemptAtMs: record.lastAttemptAtMs,
})

export const listPendingAutoConverts = (): Promise<PendingAutoConvert[]> => readAll()

export const findPendingAutoConvert = async (
  paymentRequest: string,
): Promise<PendingAutoConvert | undefined> => {
  const records = await readAll()
  return records.find((record) => record.paymentRequest === paymentRequest)
}

export const addPendingAutoConvert = (record: PendingAutoConvert): Promise<void> =>
  withWriteLock(async () => {
    const records = await readAll()
    const deduplicated = records.filter((r) => r.paymentRequest !== record.paymentRequest)
    deduplicated.push(record)
    await writeAll(deduplicated)
  })

export const removePendingAutoConvert = (paymentRequest: string): Promise<void> =>
  withWriteLock(async () => {
    const records = await readAll()
    const next = records.filter((r) => r.paymentRequest !== paymentRequest)
    if (next.length === records.length) return
    await writeAll(next)
  })

export const recordAutoConvertAttempt = (
  paymentRequest: string,
  nowMs: number,
): Promise<void> =>
  withWriteLock(async () => {
    const records = await readAll()
    const index = records.findIndex((r) => r.paymentRequest === paymentRequest)
    if (index === -1) return
    records[index] = {
      ...records[index],
      attempts: records[index].attempts + 1,
      lastAttemptAtMs: nowMs,
    }
    await writeAll(records)
  })

export const pruneExpiredAutoConverts = (nowMs: number): Promise<void> =>
  withWriteLock(async () => {
    const records = await readAll()
    const fresh = records.filter((r) => nowMs - r.createdAtMs < RECORD_TTL_MS)
    if (fresh.length === records.length) return
    await writeAll(fresh)
  })

const isAutoConvertPairing = (value: unknown): value is AutoConvertPairing => {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.receivePaymentId === "string" &&
    typeof candidate.conversionPaymentId === "string" &&
    typeof candidate.pairedAtMs === "number"
  )
}

const readPairings = async (): Promise<AutoConvertPairing[]> => {
  try {
    const raw = await AsyncStorage.getItem(PAIRINGS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isAutoConvertPairing)
  } catch (err) {
    reportError("auto-convert-storage readPairings", err)
    return []
  }
}

const writePairings = async (pairings: AutoConvertPairing[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(PAIRINGS_STORAGE_KEY, JSON.stringify(pairings))
  } catch (err) {
    reportError("auto-convert-storage writePairings", err)
  }
}

export const listAutoConvertPairings = (): Promise<AutoConvertPairing[]> => readPairings()

export const markAutoConvertPairing = (pairing: AutoConvertPairing): Promise<void> =>
  withWriteLock(async () => {
    const pairings = await readPairings()
    const deduplicated = pairings.filter(
      (p) =>
        p.receivePaymentId !== pairing.receivePaymentId &&
        p.conversionPaymentId !== pairing.conversionPaymentId,
    )
    deduplicated.push(pairing)
    await writePairings(deduplicated)
  })

export const pruneExpiredAutoConvertPairings = (nowMs: number): Promise<void> =>
  withWriteLock(async () => {
    const pairings = await readPairings()
    const fresh = pairings.filter((p) => nowMs - p.pairedAtMs < PAIRING_TTL_MS)
    if (fresh.length === pairings.length) return
    await writePairings(fresh)
  })
