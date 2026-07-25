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

  /** no-cache: a cached me could serve the previous account's owner id after a switch. */
  const { data, loading } = useMigrationOwnerQuery({
    skip: !isAuthed || !isCustodial,
    fetchPolicy: "no-cache",
  })

  return {
    ownerId: isCustodial ? data?.me?.defaultAccount?.id ?? null : null,
    loading: isCustodial && loading,
  }
}
