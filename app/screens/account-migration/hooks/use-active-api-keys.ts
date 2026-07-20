import { gql } from "@apollo/client"

import { useMigrationApiKeysQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"

gql`
  query migrationApiKeys {
    me {
      id
      apiKeys {
        id
        revoked
        expired
      }
    }
  }
`

type UseActiveApiKeys = {
  hasActiveApiKeys: boolean
  loading: boolean
  isReady: boolean
  hasError: boolean
  refetch: () => Promise<unknown>
}

/**
 * Detects whether the account still has usable API keys, so the migration flow
 * can warn that the API is unavailable in non-custodial mode. isReady stays false until
 * the query settles WITH data, so a failed request is never read as "no API keys".
 */
export const useActiveApiKeys = (): UseActiveApiKeys => {
  const isAuthed = useIsAuthed()
  const { data, loading, error, refetch } = useMigrationApiKeysQuery({ skip: !isAuthed })

  const apiKeys = data?.me?.apiKeys
  const hasActiveApiKeys = (apiKeys ?? []).some(
    (apiKey) => !apiKey.revoked && !apiKey.expired,
  )

  return {
    hasActiveApiKeys,
    loading,
    isReady: !loading && !error && apiKeys !== undefined,
    hasError: Boolean(error),
    refetch,
  }
}
