import { gql, useFragment } from "@apollo/client"

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
  const { data, complete } = useFragment<CardTransactionDetailsFragment>({
    fragment: CardTransactionDetailsFragmentDoc,
    fragmentName: "CardTransactionDetails",
    from: { __typename: "CardTransaction", id: transactionId },
  })

  return { transaction: complete ? data : null }
}
