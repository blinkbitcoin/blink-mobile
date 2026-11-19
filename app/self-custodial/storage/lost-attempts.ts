import type { Network } from "@breeztech/breez-sdk-spark-react-native"

import { reportError } from "@app/utils/error-logging"
import { loadJsonOrThrow, removeOrThrow, saveJson } from "@app/utils/storage"

import type {
  LostAttempts,
  LostConversion,
  LostSend,
  RequestedAs,
  UnresolvedSend,
} from "../payment-details/lost-attempts"

/**
 * How long a lost attempt outlives the app, from its latest attempt: past the longest a
 * Lightning payment can stay pending (its HTLCs time out within about two weeks), so its
 * outcome is settled one way or the other, and its sender has seen it in their history.
 * Not for good: a look that cannot read the history (more sends since than it reads, or
 * a send the wallet never describes) would refuse every send to the destination forever.
 */
export const LOST_ATTEMPTS_TTL_MS = 14 * 24 * 60 * 60 * 1000

const keyFor = (walletId: string) => `selfCustodialLostAttempts:${walletId}`

/**
 * The name a wallet's lost attempts are kept under across launches: its account and
 * network. Never its storage directory, whose absolute path can move with an app update.
 */
export const lostAttemptsWalletId = (accountId: string, network: Network): string =>
  `${network}:${accountId}`

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string")

const isOptional = (value: unknown, type: "string" | "number"): boolean =>
  value === undefined || typeof value === type

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const isRequestedAs = (value: unknown): value is RequestedAs =>
  isRecord(value) &&
  typeof value.entered === "string" &&
  typeof value.settlement === "string"

const isRequestRecord = (value: unknown): value is Record<string, RequestedAs> =>
  isRecord(value) && Object.values(value).every(isRequestedAs)

const isLostSend = (value: unknown): value is LostSend => {
  if (!isRecord(value)) return false
  const hasTimes =
    typeof value.startedAtMs === "number" && typeof value.walletClockSec === "number"
  const hasIdentities =
    isStringArray(value.paymentHashes) && isStringArray(value.sparkInvoices)
  const hasValidRequests =
    value.requestedAs === undefined || isRequestRecord(value.requestedAs)
  const hasValidOptionals =
    isOptional(value.idempotencyKey, "string") &&
    isOptional(value.lastAttemptAtMs, "number") &&
    hasValidRequests
  return hasTimes && hasIdentities && hasValidOptionals
}

/** Lost attempts lapse with the latest of them, never with the first. */
const lastAttemptOf = (lost: { startedAtMs: number; lastAttemptAtMs?: number }): number =>
  lost.lastAttemptAtMs ?? lost.startedAtMs

const isExpectedDelivery = (value: unknown): boolean =>
  isRecord(value) &&
  isOptional(value.tokenIdentifier, "string") &&
  typeof value.amount === "number" &&
  isOptional(value.amountIn, "number") &&
  isOptional(value.receiveRecordedAtMs, "number") &&
  typeof value.isAutomatic === "boolean"

const isLostConversion = (value: unknown): value is LostConversion => {
  if (!isRecord(value)) return false
  const hasTimes =
    typeof value.startedAtMs === "number" &&
    typeof value.lastAttemptAtMs === "number" &&
    typeof value.walletClockSec === "number"
  const hasDeliveries =
    Array.isArray(value.expectedDeliveries) &&
    value.expectedDeliveries.every(isExpectedDelivery)
  return hasTimes && isStringArray(value.knownPaymentIds) && hasDeliveries
}

const isUnresolvedSend = (value: unknown): value is UnresolvedSend => {
  if (!isRecord(value)) return false
  const hasValidKey = isOptional(value.idempotencyKey, "string")
  const hasValidRequest =
    value.requestedAs === undefined || isRequestedAs(value.requestedAs)
  return hasValidKey && hasValidRequest && isOptional(value.recordedAtMs, "number")
}

const isFresh = (recordedAtMs: number | undefined, nowMs: number): boolean =>
  recordedAtMs !== undefined && nowMs - recordedAtMs < LOST_ATTEMPTS_TTL_MS

/**
 * What a stored destination still holds: each attempt that reads as one and is not past
 * its time. A malformed or stale one is dropped without the others, since one lost attempt
 * unreadable is no reason to forget another.
 */
const freshAttemptsOf = (value: unknown, nowMs: number): LostAttempts => {
  if (!isRecord(value)) return {}
  const { lostSend, unresolvedSend, lostConversion } = value
  const isLostSendKept = isLostSend(lostSend) && isFresh(lastAttemptOf(lostSend), nowMs)
  const isUnresolvedKept =
    isUnresolvedSend(unresolvedSend) && isFresh(unresolvedSend.recordedAtMs, nowMs)
  const isConversionKept =
    isLostConversion(lostConversion) && isFresh(lastAttemptOf(lostConversion), nowMs)
  return {
    ...(isLostSendKept ? { lostSend } : {}),
    ...(isUnresolvedKept ? { unresolvedSend } : {}),
    ...(isConversionKept ? { lostConversion } : {}),
  }
}

/** Whether a destination still holds anything lost: one that holds nothing is not kept. */
export const holdsAnAttempt = (attempts: LostAttempts): boolean =>
  Boolean(attempts.lostSend || attempts.unresolvedSend || attempts.lostConversion)

/**
 * The lost attempts a wallet left when the app last ran, by destination. Empty when there
 * are none, or what is stored no longer parses. A read that fails is reported and thrown:
 * it is no answer, and a caller that took it for "nothing stored" would write over what
 * an earlier launch kept.
 */
export const loadLostAttempts = async (
  walletId: string,
  nowMs: number = Date.now(),
): Promise<Map<string, LostAttempts>> => {
  try {
    const parsed: unknown = await loadJsonOrThrow(keyFor(walletId))
    if (!isRecord(parsed)) return new Map()
    const kept = Object.entries(parsed)
      .map(
        ([destination, value]) => [destination, freshAttemptsOf(value, nowMs)] as const,
      )
      .filter(([, attempts]) => holdsAnAttempt(attempts))
    return new Map(kept)
  } catch (err) {
    reportError("Self-custodial lost attempts load", err)
    throw err
  }
}

/**
 * Keeps a wallet's lost attempts for the next time the app runs. A write that fails is
 * reported and thrown: what it did not keep, the next launch does not know, so the caller
 * has to see it to try again.
 */
export const saveLostAttempts = async (
  walletId: string,
  attempts: ReadonlyMap<string, LostAttempts>,
): Promise<void> => {
  try {
    if (attempts.size === 0) {
      await removeOrThrow(keyFor(walletId))
      return
    }
    await saveJson(keyFor(walletId), Object.fromEntries(attempts))
  } catch (err) {
    reportError("Self-custodial lost attempts save", err)
    throw err
  }
}

/** Forgets a wallet's lost attempts, as its deletion does: nothing of it outlives it. A
 *  removal that fails is reported and thrown, for the caller to see. */
export const removeLostAttempts = async (walletId: string): Promise<void> => {
  try {
    await removeOrThrow(keyFor(walletId))
  } catch (err) {
    reportError("Self-custodial lost attempts remove", err)
    throw err
  }
}
