import { gql } from "@apollo/client"

import { useCardHolderQuery } from "@app/graphql/generated"

gql`
  query cardHolder($cardId: ID!) {
    cardHolder(cardId: $cardId) {
      firstName
      lastName
    }
  }
`

export const useCardHolder = (cardId: string | undefined) => {
  const { data, loading } = useCardHolderQuery({
    variables: { cardId: cardId ?? "" },
    skip: !cardId,
    fetchPolicy: "cache-first",
  })

  const firstName = data?.cardHolder.firstName ?? ""
  const lastName = data?.cardHolder.lastName ?? ""
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : ""

  return { firstName, lastName, fullName, loading }
}
