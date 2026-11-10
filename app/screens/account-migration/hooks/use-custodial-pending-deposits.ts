import { useCallback, useState } from "react"
import { gql } from "@apollo/client"

import {
  MigrationPendingDepositsQuery,
  SettlementViaOnChain,
  TxDirection,
  useMigrationPendingDepositsQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { PendingDepositCheck, PendingDepositCheckStatus } from "@app/types/migration"
import { toError } from "@app/utils/error-reporting"

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

/**
 * The backend stops counting a pending deposit 48 hours after it was created, so a
 * transaction stuck in the mempool cannot block the migration forever. The same window
 * applies here: holding a user the server would let through only traps them behind a
 * deposit that may never confirm.
 */
const PENDING_DEPOSIT_MAX_AGE_MS = 48 * 60 * 60 * 1000
const MS_PER_SECOND = 1000

type PendingTransactions =
  | NonNullable<
      MigrationPendingDepositsQuery["me"]
    >["defaultAccount"]["pendingIncomingTransactions"]
  | undefined

const readPendingTransactions = (
  data: MigrationPendingDepositsQuery | undefined,
): PendingTransactions => data?.me?.defaultAccount?.pendingIncomingTransactions

const hasPendingOnChainReceive = (transactions: PendingTransactions): boolean => {
  const cutoffMs = Date.now() - PENDING_DEPOSIT_MAX_AGE_MS
  return (transactions ?? []).some(
    ({ direction, settlementVia, createdAt }) =>
      direction === TxDirection.Receive &&
      settlementVia.__typename === ON_CHAIN_SETTLEMENT &&
      createdAt * MS_PER_SECOND > cutoffMs,
  )
}

type UseCustodialPendingDepositsOptions = {
  /** For a screen that only needs the answer once something has told it to look. */
  skip?: boolean
}

type UseCustodialPendingDeposits = {
  hasPendingDeposit: boolean
  loading: boolean
  isReady: boolean
  hasError: boolean
  check: () => Promise<PendingDepositCheck>
  /** The same check, started by the user: its spinner is `isRecheckRunning`. */
  recheck: () => Promise<PendingDepositCheck>
  isRecheckRunning: boolean
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
   *  render. Never rejects: a request that failed, which the error state shows as well, or
   *  an answer without the list is Unknown, and each caller says what that means for it. */
  const check = useCallback(async (): Promise<PendingDepositCheck> => {
    try {
      const { data: freshData } = await refetch()
      const freshTransactions = readPendingTransactions(freshData)
      if (freshTransactions === undefined) {
        return { status: PendingDepositCheckStatus.Unknown, error: null }
      }
      const isPending = hasPendingOnChainReceive(freshTransactions)
      return isPending
        ? { status: PendingDepositCheckStatus.Pending }
        : { status: PendingDepositCheckStatus.Clear }
    } catch (err) {
      return { status: PendingDepositCheckStatus.Unknown, error: toError(err) }
    }
  }, [refetch])

  /** A check the user started (an OK, an Approve), apart from the ones the same query runs
   *  on its own (a mount, a focus, a retry), so a spinner shown for it only ever answers a
   *  tap. Counted, so a second tap while the first check is out keeps it on until both
   *  have answered. */
  const [rechecksRunning, setRechecksRunning] = useState(0)
  const recheck = useCallback(async (): Promise<PendingDepositCheck> => {
    setRechecksRunning((running) => running + 1)
    const answer = await check()
    setRechecksRunning((running) => running - 1)
    return answer
  }, [check])

  return {
    hasPendingDeposit: hasPendingOnChainReceive(pendingTransactions),
    loading,
    isReady: !error && pendingTransactions !== undefined,
    hasError: Boolean(error),
    check,
    recheck,
    isRecheckRunning: rechecksRunning > 0,
  }
}
