import { useCallback, useEffect, useRef, useState } from "react"

import { gql } from "@apollo/client"

import { useMigrationStartMutation } from "@app/graphql/generated"
import { isNetworkFailure } from "@app/graphql/transport-error"
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

  /**
   * Whether an answer still speaks for the screen: only an unmount or a newer attempt
   * retires one. A change to skip does not, since skip only holds the next attempt back:
   * an accepted start dropped because one of its inputs flipped while it was out would
   * leave the lock armed server-side with nothing here to fire the start again.
   */
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  /** A settled outcome stays settled however often the caller asks: retrying a refusal only
   *  replays the same answer, and re-firing an accepted start would re-arm an armed lock. */
  const retry = useCallback(() => {
    if (isRejected || isStarted) return
    setHasConnectionIssue(false)
    setAttempt((previous) => previous + 1)
  }, [isRejected, isStarted])

  /** A settled outcome also keeps a retry asked for before it settled from firing: an
   *  accepted start answering after the caller requested another needs no second one. */
  const isSettled = isStarted || isRejected

  /**
   * Whether any attempt has been accepted. An acceptance is never stale: the server has
   * the run, whichever request carried it. So it settles the start even when a newer
   * attempt has gone out since (the shared retry can send one while the first is still
   * out), and nothing that answers afterwards undoes it: the repeat's refusal, or its
   * dropped connection, is about a start the server already holds. Read through a ref
   * because those later answers land in closures from before the acceptance.
   */
  const isAcceptedRef = useRef(false)

  useEffect(() => {
    if (skip || isSettled || firedAttemptRef.current === attempt) return

    firedAttemptRef.current = attempt
    const isCurrent = () => isMountedRef.current && firedAttemptRef.current === attempt

    const run = async () => {
      try {
        const { data } = await startMigration()
        const payload = data?.migrationStart

        /** A settled response with no payload is not a started migration: the answer never
         *  arrived, so it earns the shared retry rather than arming the lock on the strength
         *  of no answer. Reported because a 200 with no data is not a plain network drop. */
        if (!payload) {
          reportError(
            "Migration start empty payload",
            new Error("migrationStart returned no payload"),
          )
          if (!isCurrent() || isAcceptedRef.current) return
          setHasConnectionIssue(true)
          return
        }

        const [rejection] = payload.errors ?? []
        if (!rejection) {
          if (!isMountedRef.current) return
          isAcceptedRef.current = true
          /** An answer settles the connection question too: an earlier attempt's dropped
           *  request may have raised it after the caller asked for this one. */
          setHasConnectionIssue(false)
          setIsRejected(false)
          setIsStarted(true)
          return
        }

        reportError("Migration start rejected", new Error(rejection.message))
        if (!isCurrent() || isAcceptedRef.current) return
        setHasConnectionIssue(false)
        setIsRejected(true)
      } catch (err) {
        const isRetryable = isNetworkFailure(err)

        /** A start the network never delivered can still succeed, so support never hears
         *  about it; the caller's retry is what sends the next one. */
        if (!isRetryable) reportError("Migration start failed", err)

        if (!isCurrent() || isAcceptedRef.current) return
        setHasConnectionIssue(isRetryable)
        setIsRejected(!isRetryable)
      }
    }

    run()
  }, [skip, isSettled, attempt, startMigration])

  return { isStarted, isRejected, hasConnectionIssue, retry }
}
