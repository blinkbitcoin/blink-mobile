import { useCallback } from "react"
import { gql } from "@apollo/client"

import {
  MigrationPendingDepositsQuery,
  SettlementViaOnChain,
  TxDirection,
  useMigrationPendingDepositsQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"

gql`
  query migrationPendingDeposits {
    me {
      id
      defaultAccount {
        id
        pendingIncomingTransactions {
          ...Transaction
        }
      }
    }
  }
`

const ON_CHAIN_SETTLEMENT: SettlementViaOnChain["__typename"] = "SettlementViaOnChain"

type PendingTransactions =
  | NonNullable<
      MigrationPendingDepositsQuery["me"]
    >["defaultAccount"]["pendingIncomingTransactions"]
  | undefined

const readPendingTransactions = (
  data: MigrationPendingDepositsQuery | undefined,
): PendingTransactions => data?.me?.defaultAccount?.pendingIncomingTransactions

const hasPendingOnChainReceive = (transactions: PendingTransactions): boolean =>
  (transactions ?? []).some(
    ({ direction, settlementVia }) =>
      direction === TxDirection.Receive &&
      settlementVia.__typename === ON_CHAIN_SETTLEMENT,
  )

type UseCustodialPendingDepositsOptions = {
  /** For a screen that only needs the answer once something has told it to look. */
  skip?: boolean
}

type UseCustodialPendingDeposits = {
  hasPendingDeposit: boolean
  loading: boolean
  isReady: boolean
  hasError: boolean
  checkClear: () => Promise<boolean>
}

/**
 * Whether an on-chain deposit to the custodial account is still unconfirmed. Migrating
 * moves the balance to a new on-chain address, so a deposit that confirms afterwards lands
 * on a drained custodial account with nothing to credit it to. Asked from the network on
 * every mount, so a user who comes back once it has confirmed is let through.
 *
 * isReady stays false until the query first settles WITH data, so a failed request never
 * reads as "nothing pending". A check running again keeps the last answer and stays ready
 * while it runs, so it neither unmounts the screen showing it nor flips what that screen
 * holds back; `loading` is what tells a caller one is running. A check that fails is an
 * error like a first answer that fails.
 *
 * The list is read with the same Transaction fragment Home reads it with, because both
 * land on the same account in the shared cache: a leaner shape would leave Home's read
 * incomplete the moment this check found a deposit Home had not seen. Sharing the entry
 * also works the other way, so a Home refetch (a push notification, the app coming back
 * to the foreground) updates the answer here without another check.
 */
export const useCustodialPendingDeposits = ({
  skip = false,
}: UseCustodialPendingDepositsOptions = {}): UseCustodialPendingDeposits => {
  const isAuthed = useIsAuthed()
  const isSkipped = !isAuthed || skip

  /** notifyOnNetworkStatusChange reopens `loading` for a refetch, so a caller checking
   *  again can show it running instead of leaving the screen unchanged. */
  const { data, loading, error, refetch } = useMigrationPendingDepositsQuery({
    skip: isSkipped,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  })

  const pendingTransactions = readPendingTransactions(data)

  /** Resolves with the fresh answer, so a caller about to act on it does not wait for a
   *  render: true only when that answer arrived and holds no pending deposit. Rejects like
   *  the refetch does when the request fails, which the error state shows as well. */
  const checkClear = useCallback(async (): Promise<boolean> => {
    const { data: freshData } = await refetch()
    const freshTransactions = readPendingTransactions(freshData)
    if (freshTransactions === undefined) return false
    return !hasPendingOnChainReceive(freshTransactions)
  }, [refetch])

  return {
    hasPendingDeposit: hasPendingOnChainReceive(pendingTransactions),
    loading,
    isReady: !error && pendingTransactions !== undefined,
    hasError: Boolean(error),
    checkClear,
  }
}
