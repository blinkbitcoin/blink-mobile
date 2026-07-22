import { ApolloError, gql } from "@apollo/client"

import { MigrationStatus, useMigrationStatusQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"

gql`
  query migrationStatus {
    migration {
      status
    }
  }
`

type UseMigrationStatusOptions = {
  /** Milliseconds between re-reads, for the transfer screen watching a phase it expects
   *  to move. Omitted, the status is read once per mount. */
  pollInterval?: number
  /** For callers that already know the question does not apply, so the phase is not asked
   *  for on every launch by readers who cannot act on the answer. */
  skip?: boolean
}

type UseMigrationStatus = {
  status: MigrationStatus | null
  loading: boolean
  /** Set when the read itself failed, so a caller can tell "the server has not said" apart
   *  from "we could not ask" and block with a retry rather than treat it as not-started. */
  error?: ApolloError
  /** Re-runs the read, for a caller wiring the failed status into a retry control. */
  refetch: () => Promise<unknown>
}

/**
 * The server's migration phase, the single authority on how far this account has gone. It
 * is a lean document of its own rather than a field on the preview query because the app
 * reads this on every launch to decide the forced root screen, and the root has no use for
 * balance figures. A null status is "the server has not said", never "not started": the
 * query may still be in flight, skipped for a signed-out user, or failed, and nothing here
 * guesses on the server's behalf.
 */
export const useMigrationStatus = ({
  pollInterval,
  skip = false,
}: UseMigrationStatusOptions = {}): UseMigrationStatus => {
  const isAuthed = useIsAuthed()

  /** no-cache for the same reason as the wind-down status and the preview, with a
   *  sharper consequence here: a cached read would let one account's migration phase
   *  lock a different account out of the app. */
  const { data, loading, error, refetch } = useMigrationStatusQuery({
    skip: !isAuthed || skip,
    fetchPolicy: "no-cache",
    pollInterval,
  })

  return {
    status: data?.migration?.status ?? null,
    loading,
    error,
    refetch,
  }
}
