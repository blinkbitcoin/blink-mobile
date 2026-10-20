import { useEffect, useState } from "react"
import { ApolloClient, useApolloClient } from "@apollo/client"

import { SettingsScreenDocument } from "@app/graphql/generated"

export const FreshAccountRead = {
  Idle: "idle",
  Pending: "pending",
  Confirmed: "confirmed",
  Failed: "failed",
} as const

export type FreshAccountRead = (typeof FreshAccountRead)[keyof typeof FreshAccountRead]

type ReadState = {
  /** The client the status belongs to: a change of account replaces the client. */
  client: ApolloClient<object> | null
  status: FreshAccountRead
}

const IDLE: ReadState = { client: null, status: FreshAccountRead.Idle }

/**
 * The session's read of the account from the network, apart from the cache the screens
 * read. The persisted cache answers first, and a cache-and-network query reports the
 * cache as settled once another query writes to it while the network is still out, so
 * the query's own loading flag cannot say whether the network answered. One
 * network-only read per session instead, each time the read is enabled and for each
 * client, whose answer lands in the cache for every reader; its status says whether the
 * account on hand is one the network confirmed. A read that fails stays failed for the
 * session: other queries may write the cache again, but the network never confirmed it
 * for this one.
 */
export const useFreshAccountRead = (isEnabled: boolean): FreshAccountRead => {
  const client = useApolloClient()
  const [read, setRead] = useState<ReadState>(IDLE)

  useEffect(() => {
    if (!isEnabled) {
      setRead(IDLE)
      return
    }
    let isCurrent = true
    setRead({ client, status: FreshAccountRead.Pending })
    client
      .query({ query: SettingsScreenDocument, fetchPolicy: "network-only" })
      .then(() => {
        if (isCurrent) setRead({ client, status: FreshAccountRead.Confirmed })
      })
      .catch(() => {
        if (isCurrent) setRead({ client, status: FreshAccountRead.Failed })
      })
    return () => {
      isCurrent = false
    }
  }, [client, isEnabled])

  if (!isEnabled) return FreshAccountRead.Idle
  /** Until this client's read reports, the read is still out: a status left by an
   *  earlier session or by another account's client says nothing about this one. */
  const isReadOfClient = read.client === client
  return isReadOfClient ? read.status : FreshAccountRead.Pending
}
