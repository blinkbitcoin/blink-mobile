import { gql } from "@apollo/client"

import { WindDownQuery, useWindDownQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { WindDown } from "@app/types/wind-down"

gql`
  query windDown {
    windDown {
      status
      receiveDisabledAt
      finalDeadline
      gateArmsAt
      timezone
    }
  }
`

/** Maps the GraphQL wind-down node to the domain shape, dropping transport-only fields. */
const toWindDown = (node: WindDownQuery["windDown"]): WindDown | null => {
  if (!node) return null

  return {
    status: node.status,
    receiveDisabledAt: node.receiveDisabledAt,
    finalDeadline: node.finalDeadline,
    gateArmsAt: node.gateArmsAt,
    timezone: node.timezone,
  }
}

export type WindDownRead = {
  windDown: WindDown | null
  /** The server has not answered yet, so a null wind-down is not yet an answer: a
   *  surface that must yield to the wind-down waits on this rather than on the null. */
  isPending: boolean
}

export type WindDownReadOptions = {
  /** Leaves the server unasked, for a reader that cannot use the answer. */
  skip?: boolean
}

/**
 * The account's server-authoritative wind-down state (top-level `Query.windDown`). Null
 * means the wind-down does not affect this account, so every wind-down surface stays off;
 * the status is server-derived and the client never computes a phase from the dates.
 */
export const useWindDownStatus = ({
  skip = false,
}: WindDownReadOptions = {}): WindDownRead => {
  const isAuthed = useIsAuthed()

  /**
   * no-cache, never cache-first: windDown is an argument-less top-level field that would be
   * cached under a single global key and persisted, so any cache read serves the previous
   * account's status after a switch (an unaffected account inheriting an affected one's
   * PRE_CUTOFF). Skipping the cache entirely keeps the phase tied to the active account and
   * never writes account-scoped data under the shared key.
   */
  const { data, loading } = useWindDownQuery({
    skip: !isAuthed || skip,
    fetchPolicy: "no-cache",
  })

  return { windDown: toWindDown(data?.windDown), isPending: loading }
}
