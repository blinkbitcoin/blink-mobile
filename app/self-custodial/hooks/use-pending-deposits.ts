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
 * Resolves to an empty list in custodial mode (the custodial adapter has no
 * deposit concept), so callers need no account-type gate.
 */
export const usePendingDeposits = (): { deposits: PendingDeposit[] } => {
  const { listPendingDeposits } = usePayments()
  // Re-fetch whenever wallets refresh (e.g. ClaimedDeposits / NewDeposits SDK events).
  const { wallets } = useSelfCustodialWallet()
  const [deposits, setDeposits] = useState<PendingDeposit[]>([])
  // Coordinates concurrent fetches (focus + wallet-refresh) so only the latest
  // in-flight resolution commits state.
  const fetchGenerationRef = useRef(0)
  // Mirrors `deposits` so unchanged fetch results skip setState entirely —
  // consumers and effects keyed on the array don't churn on background refresh.
  const depositsRef = useRef<PendingDeposit[]>([])

  const fetchDeposits = useCallback(() => {
    if (!listPendingDeposits) return
    fetchGenerationRef.current += 1
    const generation = fetchGenerationRef.current
    listPendingDeposits().then(({ deposits: fetched, errors }) => {
      if (generation !== fetchGenerationRef.current) return
      // A failed listing resolves with an empty array rather than rejecting.
      // Committing it would read as "the deposit confirmed", so a listing we
      // could not trust leaves the last known deposits on screen.
      if (errors?.length) return
      if (sameDeposits(depositsRef.current, fetched)) return
      depositsRef.current = fetched
      setDeposits(fetched)
    })
    return () => {
      fetchGenerationRef.current += 1
    }
  }, [listPendingDeposits])

  // Re-fetch on SDK wallet refresh + every time the consumer comes back into
  // focus (covers the user returning from the unclaimed-deposits screen).
  useFocusEffect(fetchDeposits)
  useEffect(fetchDeposits, [fetchDeposits, wallets])

  return { deposits }
}
