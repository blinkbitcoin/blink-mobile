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
}

/**
 * Detects whether the account still has usable API keys, so the migration flow
 * can warn that the API is unavailable in non-custodial mode.
 */
export const useActiveApiKeys = (): UseActiveApiKeys => {
  const isAuthed = useIsAuthed()
  const { data, loading } = useMigrationApiKeysQuery({ skip: !isAuthed })

  const hasActiveApiKeys = (data?.me?.apiKeys ?? []).some(
    (apiKey) => !apiKey.revoked && !apiKey.expired,
  )

  return { hasActiveApiKeys, loading }
}
