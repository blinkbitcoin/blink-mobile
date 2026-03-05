import { gql } from "@apollo/client"

import { useIsAuthed } from "@app/graphql/is-authed-context"
import { CardType, useCardQuery } from "@app/graphql/generated"

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
            dailyLimitCents
            monthlyLimitCents
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

  const cards = data?.me?.defaultAccount?.cards
  const card = cards?.[0]
  const hasPhysicalCard = cards?.some((c) => c.cardType === CardType.Physical) ?? false

  return { card, hasPhysicalCard, loading, error, refetch }
}
