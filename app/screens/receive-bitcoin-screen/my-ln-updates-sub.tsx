import React, { PropsWithChildren, useState } from "react"

import { gql, useApolloClient } from "@apollo/client"
import { HomeAuthedDocument, useMyLnUpdatesSubscription } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { LnUpdateHashPaidProvider } from "@app/graphql/ln-update-context"

import { useReceiveCelebration } from "./celebration/receive-celebration-provider"
import { candidateFromUpdate } from "./celebration/update-to-candidate"

gql`
  subscription myLnUpdates {
    myUpdates {
      errors {
        message
      }
      update {
        ... on LnUpdate {
          paymentHash
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
  const { celebrate } = useReceiveCelebration()

  const { data: dataSub } = useMyLnUpdatesSubscription({ skip: !isAuthed })
  const [lastHash, setLastHash] = useState<string>("")

  React.useEffect(() => {
    const update = dataSub?.myUpdates?.update
    if (!update) return

    if (update.__typename === "LnUpdate" && update.status === "PAID") {
      client.refetchQueries({ include: [HomeAuthedDocument] })
      setLastHash(update.paymentHash)
    }

    const candidate = candidateFromUpdate(update)
    if (candidate) celebrate(candidate)
  }, [dataSub, client, celebrate])

  return <LnUpdateHashPaidProvider value={lastHash}>{children}</LnUpdateHashPaidProvider>
}
