import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { gql } from "@apollo/client"

import { WindDownQuery, useWindDownQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { WindDown } from "@app/types/wind-down"

gql`
  query windDown {
    windDown {
      status
      receiveDisabledAt
      finalDeadline
      gateArmsAt
      timezone
    }
  }
`

/** Maps the GraphQL wind-down node to the domain shape, dropping transport-only fields. */
const toWindDown = (node: WindDownQuery["windDown"]): WindDown | null => {
  if (!node) return null

  return {
    status: node.status,
    receiveDisabledAt: node.receiveDisabledAt,
    finalDeadline: node.finalDeadline,
    gateArmsAt: node.gateArmsAt,
    timezone: node.timezone,
  }
}

export type WindDownRead = {
  windDown: WindDown | null
  /** The server has not answered yet, so a null wind-down is not yet an answer: a
   *  surface that must yield to the wind-down waits on this rather than on the null. */
  isPending: boolean
}

/** How long the surfaces that yield to the wind-down wait for its answer. The read has
 *  no bound of its own, and a network that never answers would otherwise hold the
 *  two-factor prompt, and the links queued behind it, for the whole session: past the
 *  wait the wind-down counts as answered with nothing due, and a late answer still
 *  brings its push up once it lands. */
const WIND_DOWN_ANSWER_WAIT_MS = 5_000

type WindDownStatusValue = WindDownRead & {
  /** Asks the server again. The status flips at the cutoff, and a session can straddle
   *  it: a surface that must decide from the status as it is now, rather than as it was
   *  at the session start, asks for it, and every reader sees the answer. */
  refresh: () => void
}

const NO_WIND_DOWN: WindDownStatusValue = {
  windDown: null,
  isPending: false,
  refresh: () => {},
}

const WindDownStatusContext = createContext<WindDownStatusValue>(NO_WIND_DOWN)

/**
 * The account's server-authoritative wind-down state (top-level `Query.windDown`), read
 * once per session, and again on request, for every surface that acts on it: the
 * home's push into the migration and the two-factor gate that yields to that push
 * decide from one answer, so they can never disagree and leave the session with
 * neither. Null means the wind-down does not affect this account, so every wind-down
 * surface stays off; the status is server-derived and the client never computes a
 * phase from the dates.
 */
export const WindDownStatusProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const isAuthed = useIsAuthed()

  /**
   * no-cache, never cache-first: windDown is an argument-less top-level field that would be
   * cached under a single global key and persisted, so any cache read serves the previous
   * account's status after a switch (an unaffected account inheriting an affected one's
   * PRE_CUTOFF). Skipping the cache entirely keeps the phase tied to the active account and
   * never writes account-scoped data under the shared key.
   */
  const { data, loading, refetch } = useWindDownQuery({
    skip: !isAuthed,
    fetchPolicy: "no-cache",
  })

  /** A read skipped for want of a session has nothing to ask again. The last answer
   *  stands while the new one is out, and stays if it never comes. */
  const refresh = useCallback(() => {
    if (!isAuthed) return
    refetch().catch(() => {})
  }, [isAuthed, refetch])

  const [isAnswerWaitedOut, setIsAnswerWaitedOut] = useState(false)
  useEffect(() => {
    if (!loading) {
      setIsAnswerWaitedOut(false)
      return
    }
    const timer = setTimeout(() => setIsAnswerWaitedOut(true), WIND_DOWN_ANSWER_WAIT_MS)
    return () => clearTimeout(timer)
  }, [loading])

  const node = data?.windDown
  const isPending = loading && !isAnswerWaitedOut
  const read = useMemo(
    () => ({ windDown: toWindDown(node), isPending, refresh }),
    [node, isPending, refresh],
  )

  return (
    <WindDownStatusContext.Provider value={read}>
      {children}
    </WindDownStatusContext.Provider>
  )
}

/** The wind-down as the provider read it for this session; none outside the provider. */
export const useWindDownStatus = (): WindDownStatusValue =>
  useContext(WindDownStatusContext)
