import { gql } from "@apollo/client"

import { useMigrationTransactionsPresenceQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"

gql`
  query migrationTransactionsPresence {
    me {
      id
      defaultAccount {
        id
        transactions(first: 1) {
          edges {
            cursor
          }
        }
      }
    }
  }
`

type UseHasTransactions = {
  hasTransactions: boolean
  loading: boolean
}

/**
 * Tells whether the custodial account has any transaction history, so the migration flow
 * only offers the history-download step when there is something to download.
 */
export const useHasTransactions = (): UseHasTransactions => {
  const isAuthed = useIsAuthed()
  const { data, loading } = useMigrationTransactionsPresenceQuery({ skip: !isAuthed })

  const hasTransactions = (data?.me?.defaultAccount?.transactions?.edges?.length ?? 0) > 0

  return { hasTransactions, loading }
}
