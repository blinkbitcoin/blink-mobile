import { useCallback, useEffect, useRef, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { usePayments } from "@app/hooks/use-payments"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { type PendingDeposit } from "@app/types/payment"

/**
 * Deposits are pinned by id (txid:vout) and compared on status, the only field
 * the current consumers render. Fee and error details can therefore change
 * without committing: the guard trades their freshness for a stable array
 * identity, so widen it before rendering requiredFeeSats off this hook.
 */
const sameDeposits = (a: PendingDeposit[], b: PendingDeposit[]) =>
  a.length === b.length &&
  a.every((deposit, i) => deposit.id === b[i].id && deposit.status === b[i].status)

/**
 * Unclaimed onchain deposits for the active self-custodial wallet.
 * In custodial mode the payment adapter stubs `listPendingDeposits` to resolve
 * `{ deposits: [] }` (app/custodial/adapters/payment.ts), so callers need no
 * account-type gate.
 */
export const usePendingDeposits = (): {
  deposits: PendingDeposit[]
  refetch: () => Promise<void>
} => {
  const { listPendingDeposits } = usePayments()
  // Wallet refreshes proxy the SDK's deposit events (ClaimedDeposits /
  // NewDeposits land as wallet refreshes), so they drive the re-fetch below.
  const { wallets } = useSelfCustodialWallet()
  const [deposits, setDeposits] = useState<PendingDeposit[]>([])
  // Coordinates concurrent fetches (focus + wallet-refresh + pull-to-refresh)
  // so only the latest in-flight resolution commits state.
  const fetchGenerationRef = useRef(0)

  const fetchDeposits = useCallback(async (): Promise<void> => {
    // Every call invalidates older in-flight listings — including one that is
    // still resolving when the adapter has just vanished.
    fetchGenerationRef.current += 1

    if (!listPendingDeposits) {
      // The adapter disappears on account switch or SDK teardown: stale
      // deposits must not linger beside another account's balance.
      setDeposits((prev) => (prev.length === 0 ? prev : []))
      return
    }

    const generation = fetchGenerationRef.current
    const { deposits: fetched, errors } = await listPendingDeposits()
    if (generation !== fetchGenerationRef.current) return
    // A failed listing resolves with an empty array plus `errors` rather than
    // rejecting. Committing it would read as "the deposit confirmed", so an
    // untrusted listing keeps the last known deposits. Tradeoff: nothing
    // retries and no error surfaces — the stale list stands until the next
    // focus / wallet-refresh / pull-to-refresh fetch, and only adapter loss
    // (above) resets it.
    if (errors?.length) return
    setDeposits((prev) => (sameDeposits(prev, fetched) ? prev : fetched))
  }, [listPendingDeposits])

  // The focus effect owns the mount fetch and re-fires when the adapter
  // changes; it also covers the user returning from the unclaimed-deposits
  // screen.
  useFocusEffect(
    useCallback(() => {
      fetchDeposits()
      return () => {
        // Losing focus invalidates whatever is still in flight.
        fetchGenerationRef.current += 1
      }
    }, [fetchDeposits]),
  )

  // Re-fetch only when the wallets identity actually changed (an SDK refresh
  // landed). Mount and adapter changes are the focus effect's job — comparing
  // identities here stops the two channels from double-firing the listing.
  const lastWalletsRef = useRef(wallets)
  useEffect(() => {
    if (lastWalletsRef.current === wallets) return
    lastWalletsRef.current = wallets
    fetchDeposits()
  }, [fetchDeposits, wallets])

  return { deposits, refetch: fetchDeposits }
}
