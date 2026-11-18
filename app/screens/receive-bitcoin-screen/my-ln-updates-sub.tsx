import React, { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

import { gql, useApolloClient } from "@apollo/client"
import {
  HomeAuthedDocument,
  MyLnUpdatesSubscription,
  TxNotificationType,
  useMyLnUpdatesSubscription,
} from "@app/graphql/generated"
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

type Update = NonNullable<MyLnUpdatesSubscription["myUpdates"]["update"]>

/** A dead stream is restarted after 1 s, doubling to at most a minute. */
const RESUBSCRIBE_BASE_MS = 1000
const RESUBSCRIBE_MAX_MS = 60_000

/** Home shows the balance and recent payments every receive changes. The confirmed
 *  on-chain receipt is not a splash, but it moves the balance. */
const refreshesHome = (update: Update, isSplashCandidate: boolean): boolean =>
  isSplashCandidate ||
  (update.__typename === "LnUpdate" && update.status === "PAID") ||
  (update.__typename === "OnChainUpdate" &&
    update.txNotificationType === TxNotificationType.OnchainReceipt)

type UpdatesListenerProps = {
  skip: boolean
  onUpdate: (update: Update) => void
  onError: () => void
}

/** Holds the subscription alone, so a new `key` restarts it without remounting the app
 *  below `MyLnUpdateSub`. */
const UpdatesListener = ({ skip, onUpdate, onError }: UpdatesListenerProps) => {
  useMyLnUpdatesSubscription({
    skip,
    onData: ({ data }) => {
      const update = data.data?.myUpdates?.update
      if (update) onUpdate(update)
    },
    onError,
  })
  return null
}

/** Mounted once at the app root, so payments are heard on every screen, not only on
 *  Receive. Receive still reads the paid hash from the context it provides.
 *
 *  Apollo ends a subscription on its first errored result, and graphql-ws errors it once
 *  its reconnects run out. Nothing remounts the root, so the stream restarts itself: after
 *  a backoff, or at once when the app comes back to the foreground. */
export const MyLnUpdateSub = ({ children }: PropsWithChildren) => {
  const client = useApolloClient()
  const isAuthed = useIsAuthed()
  const { showSplash } = useIncomingTransactionSplash()

  const [lastHash, setLastHash] = useState<string>("")
  const [generation, setGeneration] = useState(0)
  const failures = useRef(0)
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resubscribe = useCallback(() => {
    if (retry.current) clearTimeout(retry.current)
    retry.current = null
    setGeneration((current) => current + 1)
  }, [])

  const onError = useCallback(() => {
    if (retry.current) return
    const delay = Math.min(
      RESUBSCRIBE_BASE_MS * 2 ** failures.current,
      RESUBSCRIBE_MAX_MS,
    )
    failures.current += 1
    retry.current = setTimeout(resubscribe, delay)
  }, [resubscribe])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && retry.current) resubscribe()
    })
    return () => {
      subscription.remove()
      if (retry.current) clearTimeout(retry.current)
    }
  }, [resubscribe])

  const onUpdate = useCallback(
    (update: Update) => {
      failures.current = 0

      const candidate = candidateFromUpdate(update)
      const splashShown = candidate ? showSplash(candidate) : false
      if (refreshesHome(update, candidate !== null)) {
        /** Home is under the splash until it is closed. Its refetch landing mid-entrance
         *  re-renders Home on the JS thread just as the impact's haptic and badge are due,
         *  and a slow phone plays them late: it waits for the entrance to finish. */
        const refetchHome = () => client.refetchQueries({ include: [HomeAuthedDocument] })
        if (splashShown) setTimeout(refetchHome, SPLASH_SETTLE_MS)
        else refetchHome()
      }
      if (update.__typename === "LnUpdate" && candidate?.paymentHash) {
        setLastHash(candidate.paymentHash)
      }
    },
    [client, showSplash],
  )

  return (
    <LnUpdateHashPaidProvider value={lastHash}>
      <UpdatesListener
        key={generation}
        skip={!isAuthed}
        onUpdate={onUpdate}
        onError={onError}
      />
      {children}
    </LnUpdateHashPaidProvider>
  )
}
