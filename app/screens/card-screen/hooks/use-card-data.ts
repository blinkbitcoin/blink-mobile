import { gql } from "@apollo/client"

import { useIsAuthed } from "@app/graphql/is-authed-context"
import { ApplicationStatus, CardType, useCardQuery } from "@app/graphql/generated"

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
          cardConsumerApplications {
            id
            applicationStatus
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

  const account = data?.me?.defaultAccount

  const cards = account?.cards
  const card = cards?.[0]
  const hasPhysicalCard = cards?.some((c) => c.cardType === CardType.Physical) ?? false

  const applicationId =
    account?.cardConsumerApplications?.find(
      (a) => a.applicationStatus === ApplicationStatus.Approved,
    )?.id ?? null

  return { card, hasPhysicalCard, applicationId, loading, error, refetch }
}
