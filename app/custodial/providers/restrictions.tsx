import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { ApolloError, gql } from "@apollo/client"
import {
  CustodialRestrictionsQuery,
  useCustodialRestrictionsQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
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

/** Backed off so a server that is down is not hammered, and bounded: once they are spent
 *  the verdict reads Unknown, and the app asks again on foreground and on pull to refresh. */
const RESTRICTION_RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 4000]

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
  const { accountType } = useActiveWallet()
  const isAuthed = useIsAuthed()
  /** Gating on accountType (not isSelfCustodial) keeps the question stable through the
   *  self-custodial cold-start window while the SDK connects. */
  const isSelfCustodialAccount = accountType === AccountType.SelfCustodial
  const isEnabled = isAuthed && !isSelfCustodialAccount

  const { data, loading, error, refetch } = useCustodialRestrictionsQuery({
    skip: !isEnabled,
    /** The verdict follows the account's current standing, and the app re-asks on
     *  foreground, so a cached answer would outlive the session that earned it. */
    fetchPolicy: "no-cache",
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
    await refetch().then(
      () => undefined,
      () => undefined,
    )
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
