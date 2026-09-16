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

/** Failed retries after which the verdict stops pending and reads Unknown. Asking goes on. */
const RESTRICTION_RETRY_LIMIT = 3
const RESTRICTION_RETRY_BASE_DELAY_MS = 1000
/** Caps the backoff so a connection that comes back is not left waiting long for its answer. */
const RESTRICTION_RETRY_MAX_DELAY_MS = 60_000

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

const toRetryDelay = (failedRetries: number): number =>
  Math.min(
    RESTRICTION_RETRY_BASE_DELAY_MS * 2 ** failedRetries,
    RESTRICTION_RETRY_MAX_DELAY_MS,
  )

type VerdictInputs = {
  isEnabled: boolean
  data: CustodialRestrictionsQuery | undefined
  loading: boolean
  error: ApolloError | undefined
  failedRetries: number
}

const toVerdict = ({
  isEnabled,
  data,
  loading,
  error,
  failedRetries,
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
  const hasRetriesLeft = failedRetries < RESTRICTION_RETRY_LIMIT
  const isStillRetrying = hasError && hasRetriesLeft
  if (isStillRetrying) return PENDING
  return UNKNOWN
}

/**
 * A failure is counted only once the retry that met it has come back, never when the retry
 * is sent: counting sends let the limit run out while the last retry was still in flight,
 * which read a slow answer as no answer. The next retry is scheduled only by that count, so
 * retries never overlap, and one that returns after the question was already answered or
 * dropped counts for nothing.
 */
const useRetryUntilAnswered = (
  error: ApolloError | undefined,
  refetch: () => Promise<unknown>,
): number => {
  const [failedRetries, setFailedRetries] = useState(0)
  const retryGenerationRef = useRef(0)

  useEffect(() => {
    if (!error) {
      retryGenerationRef.current += 1
      setFailedRetries(0)
      return undefined
    }

    const timer = setTimeout(() => {
      const generation = retryGenerationRef.current
      refetch().catch(() => {
        if (generation !== retryGenerationRef.current) return
        setFailedRetries((count) => count + 1)
      })
    }, toRetryDelay(failedRetries))

    return () => clearTimeout(timer)
  }, [error, failedRetries, refetch])

  return failedRetries
}

/**
 * The server's restriction verdict for the active custodial account, asked for once and
 * shared by every surface, so they can never disagree and a retry loop never runs per
 * consumer. It keeps asking while the answer is missing: a request that did not come back
 * says nothing about the region, so it is reported as Unknown and never as restricted.
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

  const failedRetries = useRetryUntilAnswered(error, refetch)

  const verdict = useMemo(
    () => toVerdict({ isEnabled, data, loading, error, failedRetries }),
    [isEnabled, data, loading, error, failedRetries],
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
    logError({
      scope: LOG_SCOPE,
      error: toReportedError(error),
      context: { failedRetries },
    })
  }, [isUnknown, error, failedRetries])

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
