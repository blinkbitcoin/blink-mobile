import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { AppState } from "react-native"

import { ApolloError, gql } from "@apollo/client"
import {
  CustodialRestrictionsQuery,
  useCustodialRestrictionsQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useBackoffRetry } from "@app/hooks/use-backoff-retry"
import { RestrictionVerdict, RestrictionVerdictStatus } from "@app/types/account"
import { AccountType } from "@app/types/wallet"
import { logError } from "@app/utils/log-error"

gql`
  query custodialRestrictions {
    custodialRestrictions {
      dollarBalance
      transfer
    }
  }
`

/**
 * Backed off so a server that is down is not hammered, and bounded. These delays sit on
 * top of the transport's own retries: the client's `RetryLink` makes up to five attempts
 * per request, the four resends spaced by a jittered, doubling delay of up to 600 ms, so
 * every attempt here is a burst of up to five on the wire and the whole budget is spent in
 * about 25 s on average and 45 s at worst. Once it is spent the verdict reads Unknown, and
 * the slow lane below takes over.
 */
const RESTRICTION_RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 4000]

/**
 * The slow lane for an Unknown verdict. The app has no connectivity listener, so without
 * this a user sitting on the home screen when signal returns would keep reading the
 * unanswered state until they pulled or switched apps. One poll a minute, each a request
 * like any other on the transport above, only while the verdict is Unknown, and off the
 * moment it is anything else. A poll on a `no-cache` query stays `no-cache`, and it does
 * not flip `loading`, so nothing pends while it runs.
 */
const UNKNOWN_VERDICT_POLL_INTERVAL_MS = 60 * 1000

/** Android keeps JavaScript timers running in the background, and a device nobody is
 *  looking at owes the server nothing; the return to the foreground re-asks anyway. */
const isAppInBackground = (): boolean => AppState.currentState !== "active"

const LOG_SCOPE = "custodial-restrictions"

const NO_ACCOUNT: RestrictionVerdict = Object.freeze({
  status: RestrictionVerdictStatus.NoAccount,
})
const PENDING: RestrictionVerdict = Object.freeze({
  status: RestrictionVerdictStatus.Pending,
})
const UNKNOWN: RestrictionVerdict = Object.freeze({
  status: RestrictionVerdictStatus.Unknown,
})

type CustodialRestrictionsContextType = {
  verdict: RestrictionVerdict
  /** Asks again now, for a user who pulled to refresh. Never rejects. */
  refetch: () => Promise<void>
}

const CustodialRestrictionsContext = createContext<CustodialRestrictionsContextType>({
  verdict: PENDING,
  refetch: async () => {},
})

export const useCustodialRestrictions = (): CustodialRestrictionsContextType =>
  useContext(CustodialRestrictionsContext)

/**
 * logError rewrites the message of the error it records, and Apollo keeps the query's own
 * error in its result, so a copy is reported instead. The name and message carry over,
 * since they are what decides how the report is classified.
 */
const toReportedError = (error: ApolloError | undefined): Error => {
  if (!error) return new Error("restrictions query settled without a verdict")
  const reportedError = new Error(error.message)
  reportedError.name = error.name
  return reportedError
}

type VerdictInputs = {
  isEnabled: boolean
  data: CustodialRestrictionsQuery | undefined
  loading: boolean
  error: ApolloError | undefined
  haveRetriesRunOut: boolean
}

const toVerdict = ({
  isEnabled,
  data,
  loading,
  error,
  haveRetriesRunOut,
}: VerdictInputs): RestrictionVerdict => {
  if (!isEnabled) return NO_ACCOUNT
  if (loading) return PENDING
  if (data) {
    const { dollarBalance, transfer } = data.custodialRestrictions
    return {
      status: RestrictionVerdictStatus.Served,
      restrictions: { dollarBalance, transfer },
    }
  }
  const hasError = Boolean(error)
  const isStillRetrying = hasError && !haveRetriesRunOut
  if (isStillRetrying) return PENDING
  return UNKNOWN
}

/**
 * Retries only a question that has no answer yet: a served verdict survives a failed
 * refetch, so asking again then would only repeat the failure. Each retry is scheduled once
 * the previous one has come back failed, so the last one is never given up on while it is
 * still in flight, and one that returns after the question was answered or dropped counts
 * for nothing.
 */
const useRetryUntilAnswered = (
  isUnanswered: boolean,
  refetch: () => Promise<unknown>,
): boolean => {
  const { schedule, reset } = useBackoffRetry(RESTRICTION_RETRY_DELAYS_MS)
  const [haveRetriesRunOut, setHaveRetriesRunOut] = useState(false)

  useEffect(() => {
    if (!isUnanswered) {
      reset()
      setHaveRetriesRunOut(false)
      return undefined
    }

    let isQuestionOpen = true
    const retryOrGiveUp = () => {
      const isRetryScheduled = schedule(() => {
        refetch().catch(() => {
          if (isQuestionOpen) retryOrGiveUp()
        })
      })
      if (!isRetryScheduled) setHaveRetriesRunOut(true)
    }
    retryOrGiveUp()

    return () => {
      isQuestionOpen = false
    }
  }, [isUnanswered, refetch, reset, schedule])

  return haveRetriesRunOut
}

/**
 * The server's restriction verdict for the active custodial account, asked for once and
 * shared by every surface, so they can never disagree and a retry loop never runs per
 * consumer. A request that did not come back says nothing about the region, so once the
 * retries are spent it is reported as Unknown and never as restricted.
 */
export const CustodialRestrictionsProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { activeAccount } = useAccountRegistry()
  const isAuthed = useIsAuthed()
  /** The account's registered type, not the wallet state: it holds steady through the
   *  self-custodial cold-start window while the SDK connects, and a balance update does not
   *  re-render the provider every surface reads from. */
  const isSelfCustodialAccount = activeAccount?.type === AccountType.SelfCustodial
  const isEnabled = isAuthed && !isSelfCustodialAccount

  const { data, loading, error, refetch, startPolling, stopPolling } =
    useCustodialRestrictionsQuery({
      skip: !isEnabled,
      /** The verdict follows the account's current standing, and the app re-asks on
       *  foreground, so a cached answer would outlive the session that earned it. */
      fetchPolicy: "no-cache",
      skipPollAttempt: isAppInBackground,
    })

  const hasFailed = Boolean(error)
  const hasAnswer = Boolean(data)
  const isUnanswered = hasFailed && !hasAnswer
  const haveRetriesRunOut = useRetryUntilAnswered(isUnanswered, refetch)

  const verdict = useMemo(
    () => toVerdict({ isEnabled, data, loading, error, haveRetriesRunOut }),
    [isEnabled, data, loading, error, haveRetriesRunOut],
  )

  const isUnknown = verdict.status === RestrictionVerdictStatus.Unknown

  useEffect(() => {
    if (!isUnknown) return undefined
    startPolling(UNKNOWN_VERDICT_POLL_INTERVAL_MS)
    return () => stopPolling()
  }, [isUnknown, startPolling, stopPolling])

  const hasReportedUnknownRef = useRef(false)

  useEffect(() => {
    if (!isUnknown) {
      hasReportedUnknownRef.current = false
      return
    }
    if (hasReportedUnknownRef.current) return
    hasReportedUnknownRef.current = true
    logError({ scope: LOG_SCOPE, error: toReportedError(error) })
  }, [isUnknown, error])

  const refetchVerdict = useCallback(async () => {
    if (!isEnabled) return
    await refetch().catch(() => undefined)
  }, [isEnabled, refetch])

  const contextValue = useMemo(
    () => ({ verdict, refetch: refetchVerdict }),
    [verdict, refetchVerdict],
  )

  return (
    <CustodialRestrictionsContext.Provider value={contextValue}>
      {children}
    </CustodialRestrictionsContext.Provider>
  )
}
