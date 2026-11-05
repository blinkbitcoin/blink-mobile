import React, { PropsWithChildren, useState } from "react"

import { gql, useApolloClient } from "@apollo/client"
import { HomeAuthedDocument, useMyLnUpdatesSubscription } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { LnUpdateHashPaidProvider } from "@app/graphql/ln-update-context"

import { useIncomingTransactionSplash } from "./incoming-transaction-splash/incoming-transaction-splash-provider"
import { candidateFromUpdate } from "./incoming-transaction-splash/update-to-candidate"

gql`
  subscription myLnUpdates {
    myUpdates {
      errors {
        message
      }
      update {
        ... on LnUpdate {
          status
          transaction {
            ...Transaction
          }
        }
        ... on IntraLedgerUpdate {
          txNotificationType
          transaction {
            ...Transaction
          }
        }
        ... on OnChainUpdate {
          txNotificationType
          transaction {
            ...Transaction
          }
        }
      }
    }
  }
`

/** Mounted once at the app root, so payments are heard on every screen, not only on
 *  Receive. Receive still reads the paid hash from the context it provides. */
export const MyLnUpdateSub = ({ children }: PropsWithChildren) => {
  const client = useApolloClient()
  const isAuthed = useIsAuthed()
  const { showSplash } = useIncomingTransactionSplash()

  const { data: dataSub } = useMyLnUpdatesSubscription({ skip: !isAuthed })
  const [lastHash, setLastHash] = useState<string>("")

  React.useEffect(() => {
    const update = dataSub?.myUpdates?.update
    if (!update) return

    const candidate = candidateFromUpdate(update)
    if (update.__typename === "LnUpdate" && update.status === "PAID") {
      client.refetchQueries({ include: [HomeAuthedDocument] })
      if (candidate?.paymentHash) setLastHash(candidate.paymentHash)
    }
    if (candidate) showSplash(candidate)
  }, [dataSub, client, showSplash])

  return <LnUpdateHashPaidProvider value={lastHash}>{children}</LnUpdateHashPaidProvider>
}
