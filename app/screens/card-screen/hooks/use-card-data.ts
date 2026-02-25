import { gql } from "@apollo/client"

import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useCardQuery } from "@app/graphql/generated"

gql`
  query card {
    me {
      id
      defaultAccount {
        id
        ... on ConsumerAccount {
          cards {
            id
            lastFour
            cardType
            status
            createdAt
          }
        }
      }
    }
  }
`

export const useCardData = () => {
  const isAuthed = useIsAuthed()

  const { data, loading, error, refetch } = useCardQuery({
    skip: !isAuthed,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
  })

  const card = data?.me?.defaultAccount?.cards?.[0]

  return { card, loading, error, refetch }
}
