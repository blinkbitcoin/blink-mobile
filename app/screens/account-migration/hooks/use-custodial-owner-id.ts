import { useCallback } from "react"

import { gql } from "@apollo/client"

import { useMigrationOwnerQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType } from "@app/types/wallet"

gql`
  query migrationOwner {
    me {
      id
      defaultAccount {
        id
      }
    }
  }
`

type UseCustodialOwnerId = {
  /** The real per-profile Galoy account id, unlike the registry's shared `custodial-default`
   *  constant. Null for a non-custodial session or before the query resolves. */
  ownerId: string | null
  loading: boolean
  /** Whether the query never ran, because nobody is authenticated or the active account is
   *  not the custodial one. A skipped query reports neither loading nor an answer, so
   *  callers that treat a settled null as a failure must exclude it: a session that just
   *  ended is not an account without an owner. */
  isSkipped: boolean
  /**
   * Whether the query failed, by any cause. Deliberately NOT split into network and
   * settled kinds the way the preview is: there the settled kind is the server answering
   * that this account has no migration, which is final, while an authenticated custodial
   * session always has an owner, so every error here is a request that failed rather than
   * an answer. Callers spend it on a retry; only a query that answered without an owner
   * is a failure worth handing to support.
   */
  hasError: boolean
  refetch: () => Promise<unknown>
}

/**
 * The owner id the migration keys its per-profile state by. The registry gives every
 * custodial profile the same `custodial-default` id, so two profiles on one device would
 * share a pending wallet, a checkpoint, and dismissals; the Galoy account id is what
 * actually tells them apart.
 */
export const useCustodialOwnerId = (): UseCustodialOwnerId => {
  const isAuthed = useIsAuthed()
  const { activeAccount } = useAccountRegistry()
  const isCustodial = activeAccount?.type === AccountType.Custodial

  const isSkipped = !isAuthed || !isCustodial

  /** no-cache: a cached me could serve the previous account's owner id after a switch.
   *  notifyOnNetworkStatusChange reopens `loading` for a refetch, so a caller reading a
   *  settled null as a missing owner never reads one mid-retry. */
  const { data, loading, error, refetch } = useMigrationOwnerQuery({
    skip: isSkipped,
    fetchPolicy: "no-cache",
    notifyOnNetworkStatusChange: true,
  })

  /** A skipped query is on standby, where a refetch would run it anyway: the one session
   *  that must never ask for `me` is the one that stopped being custodial. */
  const refetchWhenRunning = useCallback(
    () => (isSkipped ? Promise.resolve() : refetch()),
    [isSkipped, refetch],
  )

  return {
    ownerId: isCustodial ? data?.me?.defaultAccount?.id ?? null : null,
    loading: isCustodial && loading,
    isSkipped,
    hasError: Boolean(error),
    refetch: refetchWhenRunning,
  }
}
