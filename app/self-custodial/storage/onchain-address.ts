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
}

const isIssuedOnchainAddress = (value: unknown): value is IssuedOnchainAddress => {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.address !== "string") return false
  return candidate.depositMarker === null || typeof candidate.depositMarker === "string"
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
    return isIssuedOnchainAddress(parsed) ? parsed : null
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
