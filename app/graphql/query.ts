import { ApolloClient, gql } from "@apollo/client"
import { MockableApolloClient } from "../types/mockable"

export const USERNAME_AVAILABLE = gql`
  query usernameAvailable($username: Username!) {
    usernameAvailable(username: $username)
  }
`

const TRANSACTION_LIST_FRAGMENT = gql`
  fragment TransactionList on TransactionConnection {
    pageInfo {
      hasNextPage
    }
    edges {
      cursor
      node {
        __typename
        id
        status
        direction
        memo
        createdAt

        settlementAmount
        settlementFee
        settlementPrice {
          base
          offset
        }

        initiationVia {
          __typename
          ... on InitiationViaIntraLedger {
            counterPartyWalletId
            counterPartyUsername
          }
          ... on InitiationViaLn {
            paymentHash
          }
          ... on InitiationViaOnChain {
            address
          }
        }
        settlementVia {
          __typename
          ... on SettlementViaIntraLedger {
            counterPartyWalletId
            counterPartyUsername
          }
          ... on SettlementViaLn {
            paymentSecret
          }
          ... on SettlementViaOnChain {
            transactionHash
          }
        }
      }
    }
  }
`

export const MAIN_QUERY = gql`
  query mainQuery($hasToken: Boolean!) {
    globals {
      nodesIds
    }
    quizQuestions {
      id
      earnAmount
    }
    me @include(if: $hasToken) {
      id
      language
      username
      phone
      email
      quizQuestions {
        question {
          id
          earnAmount
        }
        completed
      }
      defaultAccount {
        id
        defaultWalletId
        wallets {
          id
          balance
          walletCurrency
          transactions(first: 3) {
            ...TransactionList
          }
        }
      }
    }
    mobileVersions {
      platform
      currentSupported
      minSupported
    }
  }
  ${TRANSACTION_LIST_FRAGMENT}
`

export const TRANSACTIONS_LIST = gql`
  query transactionsList($first: Int, $after: String) {
    me {
      id
      defaultAccount {
        id
        wallets {
          id
          transactions(first: $first, after: $after) {
            ...TransactionList
          }
        }
      }
    }
  }
  ${TRANSACTION_LIST_FRAGMENT}
`

export const TRANSACTIONS_LIST_FOR_CONTACT = gql`
  query transactionsListForContact($username: Username!, $first: Int, $after: String) {
    me {
      id
      contactByUsername(username: $username) {
        transactions(first: $first, after: $after) {
          ...TransactionList
        }
      }
    }
  }
  ${TRANSACTION_LIST_FRAGMENT}
`

export const fetchMainQuery = async (
  client: ApolloClient<unknown>,
  variables: { hasToken: boolean },
): Promise<void> => {
  await client.query({
    query: MAIN_QUERY,
    variables,
    fetchPolicy: "network-only",
  })
}

export const getQuizQuestions = (client: MockableApolloClient, { hasToken }) => {
  const data = client.readQuery({
    query: MAIN_QUERY,
    variables: { hasToken },
  })

  const allQuestions: Record<string, number> | null = data?.quizQuestions
    ? data.quizQuestions.reduce((acc, curr) => {
        acc[curr.id] = curr.earnAmount
        return acc
      }, {})
    : null

  const myCompletedQuestions: Record<string, number> | null = data?.me?.quizQuestions
    ? data?.me?.quizQuestions.reduce((acc, curr) => {
        if (curr.completed) {
          acc[curr.question.id] = curr.question.earnAmount
        }
        return acc
      }, {})
    : null

  return {
    allQuestions,
    myCompletedQuestions,
  }
}
