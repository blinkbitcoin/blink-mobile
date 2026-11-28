import { gql } from "@apollo/client"

import { useCardHolderQuery } from "@app/graphql/generated"

gql`
  query cardHolder($cardId: ID!) {
    cardHolder(cardId: $cardId) {
      firstName
      lastName
      dateOfBirth
      address {
        line1
        line2
        city
        region
        postalCode
        countryCode
      }
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

  /** What the issuer verified at KYC; null for each it keeps none of. */
  const dateOfBirth = data?.cardHolder.dateOfBirth ?? null
  const address = data?.cardHolder.address ?? null

  return { firstName, lastName, fullName, dateOfBirth, address, loading }
}
