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

/**
 * The account's server-authoritative wind-down state (top-level `Query.windDown`). Null
 * means the wind-down does not affect this account, so every wind-down surface stays off;
 * the status is server-derived and the client never computes a phase from the dates.
 */
export const useWindDownStatus = (): WindDown | null => {
  const isAuthed = useIsAuthed()
  const { data } = useWindDownQuery({ skip: !isAuthed })

  return toWindDown(data?.windDown)
}
