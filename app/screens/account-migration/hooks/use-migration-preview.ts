import { gql } from "@apollo/client"

import { MigrationQuery, useMigrationQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { AccountMigrationPreview } from "@app/types/wind-down"

gql`
  query migration {
    migration {
      preview {
        balanceSats
        feeSats
        feeCoveredByBlink
        receiveSats
      }
    }
  }
`

/** Maps the GraphQL migration node to the domain preview, dropping transport-only fields. */
const toMigrationPreview = (
  node: MigrationQuery["migration"],
): AccountMigrationPreview | null => {
  if (!node) return null

  const { preview } = node

  return {
    balanceSats: preview.balanceSats,
    feeSats: preview.feeSats,
    feeCoveredByBlink: preview.feeCoveredByBlink,
    receiveSats: preview.receiveSats,
  }
}

type UseMigrationPreview = {
  preview: AccountMigrationPreview | null
  loading: boolean
  isSkipped: boolean
  hasConnectionIssue: boolean
  refetch: () => Promise<unknown>
}

/**
 * The server-computed migration preview (top-level `Query.migration`): the balance being
 * migrated, the network fee, whether Blink covers it, and the resulting amount. The
 * server owns the fee, the de-minimis subsidy and the resulting amount; the client never
 * recomputes them. Four signals travel with it because a null preview alone cannot say
 * why it is null: `loading` marks one still on its way, `isSkipped` marks a query that
 * never ran at all because nobody is authenticated, and `hasConnectionIssue` marks one
 * the network prevented, which retrying through `refetch` can still resolve. Only what
 * is left, a query that ran and settled with no preview and no connection issue, is the
 * server saying this account has no migration, and no amount of retrying changes that.
 */
export const useMigrationPreview = (): UseMigrationPreview => {
  const isAuthed = useIsAuthed()
  const isSkipped = !isAuthed

  /**
   * no-cache for the same reason as the wind-down status: `migration` is an
   * argument-less top-level field whose nodes carry no id, so it lands under a single
   * global key that is persisted and never cleared on an account switch. Fetching per
   * read keeps the preview tied to the active account, and to a balance that changes
   * between visits, while notifyOnNetworkStatusChange reopens `loading` for a refetch,
   * so the retry this hook offers is visible instead of running behind a frozen screen.
   */
  const { data, loading, error, refetch } = useMigrationQuery({
    skip: isSkipped,
    fetchPolicy: "no-cache",
    notifyOnNetworkStatusChange: true,
  })

  return {
    preview: toMigrationPreview(data?.migration),
    loading,
    isSkipped,
    hasConnectionIssue: Boolean(error?.networkError),
    refetch,
  }
}
