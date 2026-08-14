import AsyncStorage from "@react-native-async-storage/async-storage"

import {
  NormalizedTransaction,
  PaymentType,
  TransactionDirection,
} from "@app/types/transaction"
import { recordAppError } from "@app/utils/error-reporting"

const keyFor = (accountId: string) => `selfCustodialOnchainAddress:${accountId}`

/**
 * The on-chain address we last handed out, plus a snapshot of the wallet's on-chain
 * receive history at that moment.
 *
 * The Spark SDK never reports which address a deposit landed on, so we infer reuse:
 * if the newest on-chain receipt is no longer the one recorded here, money came in
 * since we issued the address and it must be rotated.
 */
export type IssuedOnchainAddress = {
  address: string
  depositMarker: string | null
  /**
   * Ids (`txid:vout`) of unclaimed deposits we have already rotated for. A deposit
   * that is still waiting to be claimed never reaches `listPayments`, so the marker
   * above cannot see it — this list is how the fee-gated case moves us off an address.
   *
   * It only ever grows (capped below): `listPendingDeposits` resolves to an empty
   * array both when there is nothing pending and when the listing failed or has not
   * run yet, so dropping ids to match it would rotate again for deposits we already
   * handled.
   */
  seenPendingDepositIds?: string[]
}

/**
 * Enough ids that a wallet would need 50+ unclaimed deposits between two visits to
 * the receive screen before the oldest falls off — and falling off costs one needless
 * rotation, never a missed one.
 */
const SEEN_PENDING_DEPOSIT_LIMIT = 50

/**
 * Newest-last union of what we knew and what we can see now, capped from the front.
 */
export const mergeSeenPendingDepositIds = (
  stored: string[] | undefined,
  current: string[],
): string[] => {
  const merged = [...(stored ?? [])]
  for (const id of current) {
    if (!merged.includes(id)) merged.push(id)
  }
  return merged.slice(-SEEN_PENDING_DEPOSIT_LIMIT)
}

const isIssuedOnchainAddress = (value: unknown): value is IssuedOnchainAddress => {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.address !== "string") return false
  return candidate.depositMarker === null || typeof candidate.depositMarker === "string"
}

/**
 * A malformed `seenPendingDepositIds` degrades to "none seen" rather than rejecting the
 * whole record: an unreadable record reads as "no address issued yet", which would turn
 * the reuse detection off entirely.
 */
const readSeenPendingDepositIds = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const ids = value.filter((id): id is string => typeof id === "string")
  return ids.length > 0 ? ids : undefined
}

/**
 * The id of the newest incoming on-chain transaction, or null when there are none.
 * `allTransactions` arrives newest-first from the wallet provider.
 */
export const latestOnchainReceiptId = (
  transactions: NormalizedTransaction[],
): string | null =>
  transactions.find(
    (tx) =>
      tx.paymentType === PaymentType.Onchain &&
      tx.direction === TransactionDirection.Receive,
  )?.id ?? null

/** A missing or unreadable record means "no address issued yet" — never throws. */
export const loadIssuedOnchainAddress = async (
  accountId: string,
): Promise<IssuedOnchainAddress | null> => {
  try {
    const raw = await AsyncStorage.getItem(keyFor(accountId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isIssuedOnchainAddress(parsed)) return null
    return {
      address: parsed.address,
      depositMarker: parsed.depositMarker,
      seenPendingDepositIds: readSeenPendingDepositIds(parsed.seenPendingDepositIds),
    }
  } catch (err) {
    recordAppError(
      err instanceof Error
        ? err
        : new Error(`Issued onchain address read failed: ${err}`),
    )
    return null
  }
}

export const saveIssuedOnchainAddress = async (
  accountId: string,
  value: IssuedOnchainAddress,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(keyFor(accountId), JSON.stringify(value))
  } catch (err) {
    // A failed write only costs us a rotation on the next visit; the address on
    // screen is still valid, so this must not surface to the user.
    recordAppError(
      err instanceof Error
        ? err
        : new Error(`Issued onchain address write failed: ${err}`),
    )
  }
}
