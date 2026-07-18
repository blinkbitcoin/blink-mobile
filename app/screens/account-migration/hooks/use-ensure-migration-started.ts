import { useCallback, useEffect, useRef, useState } from "react"

import { gql } from "@apollo/client"

import { useMigrationStartMutation } from "@app/graphql/generated"
import { reportError } from "@app/utils/error-logging"

gql`
  mutation migrationStart {
    migrationStart {
      errors {
        message
        code
      }
      migration {
        status
      }
    }
  }
`

type UseEnsureMigrationStartedOptions = {
  skip: boolean
}

type UseEnsureMigrationStarted = {
  isStarted: boolean
  isRejected: boolean
  hasConnectionIssue: boolean
  retry: () => void
}

const isNetworkFailure = (err: unknown): boolean =>
  Boolean(err instanceof Error && "networkError" in err && err.networkError)

/**
 * Arms the server-side lock by declaring the migration started, once per visit to the
 * commit screen. The backend mutation is idempotent, so nothing here needs a durable
 * latch beyond not firing twice for one arrival, and a rejected start leaves the status
 * at NOT_STARTED, which is what keeps a user the server refuses from being sealed into a
 * flow they cannot finish. The refusal reason is deliberately not parsed: the backend
 * maps its dollar-balance rejection onto the same MIGRATION_STATE_CONFLICT code as a real
 * state conflict, so telling them apart would mean matching on message text.
 */
export const useEnsureMigrationStarted = ({
  skip,
}: UseEnsureMigrationStartedOptions): UseEnsureMigrationStarted => {
  const [startMigration] = useMigrationStartMutation()
  const [isStarted, setIsStarted] = useState(false)
  const [isRejected, setIsRejected] = useState(false)
  const [hasConnectionIssue, setHasConnectionIssue] = useState(false)
  const [attempt, setAttempt] = useState(0)

  /**
   * Which attempt already went out, rather than a plain "has fired" flag, and claimed
   * before the request rather than after it answers. Only a new attempt number fires the
   * mutation, so nothing the effect cannot control, an unstable mutate identity from
   * Apollo or an extra render after a failure, can turn a failed start into a loop of
   * them, and a re-render mid-flight cannot start a second one.
   */
  const firedAttemptRef = useRef(-1)

  /** Retrying a refusal would only replay the same answer, so a settled rejection stays
   *  settled however often the caller asks. */
  const retry = useCallback(() => {
    if (isRejected) return
    setHasConnectionIssue(false)
    setAttempt((previous) => previous + 1)
  }, [isRejected])

  useEffect(() => {
    if (skip || firedAttemptRef.current === attempt) return

    firedAttemptRef.current = attempt

    let isActive = true

    const run = async () => {
      try {
        const { data } = await startMigration()
        const [rejection] = data?.migrationStart.errors ?? []
        if (rejection)
          reportError("Migration start rejected", new Error(rejection.message))
        if (!isActive) return
        setIsRejected(Boolean(rejection))
        setIsStarted(!rejection)
      } catch (err) {
        const isRetryable = isNetworkFailure(err)

        /** A start the network never delivered can still succeed, so support never hears
         *  about it; the caller's retry is what sends the next one. */
        if (!isRetryable) reportError("Migration start failed", err)

        if (!isActive) return
        setHasConnectionIssue(isRetryable)
        setIsRejected(!isRetryable)
      }
    }

    run()

    return () => {
      isActive = false
    }
  }, [skip, attempt, startMigration])

  return { isStarted, isRejected, hasConnectionIssue, retry }
}
