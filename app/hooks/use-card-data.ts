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

export const useCardData = ({ skip = false }: { skip?: boolean } = {}) => {
  const isAuthed = useIsAuthed()

  const { data, loading, error, refetch } = useCardQuery({
    skip: !isAuthed || skip,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
  })

  /** False until the query answers, so a first lookup that fails is never read as an
   *  account without a card. Apollo keeps the last answer when a later fetch fails. */
  const hasLoaded = data !== undefined
  const account = data?.me?.defaultAccount

  const cards = account?.cards
  const card = cards?.[0]
  const hasPhysicalCard = cards?.some((c) => c.cardType === CardType.Physical) ?? false

  const applicationId =
    account?.cardConsumerApplications?.find(
      (a) => a.applicationStatus === ApplicationStatus.Approved,
    )?.id ?? null

  return { card, hasPhysicalCard, applicationId, hasLoaded, loading, error, refetch }
}
