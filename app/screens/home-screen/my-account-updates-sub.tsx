import React, { PropsWithChildren } from "react"
import { gql, useApolloClient } from "@apollo/client"

import { HomeAuthedDocument, useAccountUpdatesSubscription } from "@app/graphql/generated"

gql`
  subscription accountUpdates {
    myUpdates {
      errors {
        message
      }
      update {
        __typename
      }
      me {
        defaultAccount {
          id
          wallets {
            id
            balance
            walletCurrency
          }
        }
      }
    }
  }
`

const REFETCH_UPDATE_TYPES = ["IntraLedgerUpdate", "LnUpdate", "OnChainUpdate"]

export const MyAccountUpdatesSub = ({ children }: PropsWithChildren) => {
  const client = useApolloClient()

  const { data: dataSub } = useAccountUpdatesSubscription()

  React.useEffect(() => {
    const typename = dataSub?.myUpdates?.update?.__typename
    if (typename && REFETCH_UPDATE_TYPES.includes(typename)) {
      console.error(dataSub?.myUpdates)
      client.refetchQueries({ include: [HomeAuthedDocument] })
    }
  }, [dataSub, client])

  return <>{children}</>
}

export const withMyAccountUpdatesSub = <P extends object>(
  Component: React.ComponentType<P>,
) => {
  return function WithMyAccountUpdatesSub(props: PropsWithChildren<P>) {
    return (
      <MyAccountUpdatesSub>
        <Component {...props} />
      </MyAccountUpdatesSub>
    )
  }
}
