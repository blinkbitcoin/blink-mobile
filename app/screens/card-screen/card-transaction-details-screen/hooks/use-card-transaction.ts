import { gql, useApolloClient } from "@apollo/client"

import {
  CardTransactionDetailsFragment,
  CardTransactionDetailsFragmentDoc,
} from "@app/graphql/generated"

gql`
  fragment CardTransactionDetails on CardTransaction {
    id
    amount
    currency
    merchantName
    status
    createdAt
  }
`

export const useCardTransaction = (transactionId: string) => {
  const client = useApolloClient()

  const transaction = client.readFragment<CardTransactionDetailsFragment>({
    id: client.cache.identify({ __typename: "CardTransaction", id: transactionId }),
    fragment: CardTransactionDetailsFragmentDoc,
  })

  return { transaction: transaction ?? null }
}
