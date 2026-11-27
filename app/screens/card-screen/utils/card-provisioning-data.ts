import { ApolloClient, gql } from "@apollo/client"

import {
  CardProvisioningDataDocument,
  CardProvisioningDataQuery,
  CardProvisioningDataQueryVariables,
} from "@app/graphql/generated"

import type { CardholderAddress, CardProvisioningData } from "../types"

gql`
  query cardProvisioningData($cardId: ID!) {
    cardProvisioningData(cardId: $cardId) {
      processorCardId
      cardSecret
      displayName
      cardholderAddress {
        name
        line1
        line2
        city
        region
        postalCode
        countryCode
        phoneNumber
      }
    }
  }
`

type ProvisioningAddress = NonNullable<
  CardProvisioningDataQuery["cardProvisioningData"]["cardholderAddress"]
>

const toCardholderAddress = (address: ProvisioningAddress): CardholderAddress => ({
  name: address.name,
  line1: address.line1,
  line2: address.line2 ?? "",
  city: address.city,
  region: address.region,
  postalCode: address.postalCode,
  countryCode: address.countryCode,
  phoneNumber: address.phoneNumber ?? undefined,
})

/** What a device wallet needs for a card, asked right before the add. Rain's secret for it
 *  lasts a short time and must not be kept, so the answer never goes into the cache. */
export const fetchCardProvisioningData = async (
  client: ApolloClient<object>,
  cardId: string,
): Promise<CardProvisioningData> => {
  const { data } = await client.query<
    CardProvisioningDataQuery,
    CardProvisioningDataQueryVariables
  >({
    query: CardProvisioningDataDocument,
    variables: { cardId },
    fetchPolicy: "no-cache",
  })
  const { processorCardId, cardSecret, displayName, cardholderAddress } =
    data.cardProvisioningData
  const address = cardholderAddress ? toCardholderAddress(cardholderAddress) : undefined

  return { processorCardId, cardSecret, displayName, address }
}
