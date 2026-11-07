import React, { PropsWithChildren, useState } from "react"

import { gql, useApolloClient } from "@apollo/client"
import { HomeAuthedDocument, useMyLnUpdatesSubscription } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { LnUpdateHashPaidProvider } from "@app/graphql/ln-update-context"

import { useIncomingTransactionSplash } from "./incoming-transaction-splash/incoming-transaction-splash-context"
import { SPLASH_SETTLE_MS } from "./incoming-transaction-splash/types"
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
    const splashShown = candidate ? showSplash(candidate) : false
    if (update.__typename === "LnUpdate" && update.status === "PAID") {
      /** Home is under the splash until it is closed. Its refetch landing mid-entrance
       *  re-renders Home on the JS thread just as the impact's haptic and badge are due,
       *  and a slow phone plays them late: it waits for the entrance to finish. */
      const refetchHome = () => client.refetchQueries({ include: [HomeAuthedDocument] })
      if (splashShown) setTimeout(refetchHome, SPLASH_SETTLE_MS)
      else refetchHome()
      if (candidate?.paymentHash) setLastHash(candidate.paymentHash)
    }
  }, [dataSub, client, showSplash])

  return <LnUpdateHashPaidProvider value={lastHash}>{children}</LnUpdateHashPaidProvider>
}
