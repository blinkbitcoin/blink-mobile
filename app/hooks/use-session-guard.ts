import { useCallback, useMemo, useRef } from "react"

import { useIsMounted } from "@app/hooks/use-is-mounted"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveSessionKey } from "@app/store/persistent-state/account-key"

/**
 * Binds work that awaits between requests to the screen and the session it began
 * under. Each request goes out through the client of the moment, so after a logout or
 * an account switch the next one would land on the other account; and once the screen
 * is gone, nothing it owes can be shown. A screen that is gone renders no more, so the
 * session it last saw may be stale: the check answers false for it rather than guess.
 */
export const useSessionGuard = () => {
  const { persistentState } = usePersistentStateContext()
  const { galoyAuthToken, activeAccountId } = persistentState
  const sessionKey = useMemo(
    () => resolveSessionKey({ galoyAuthToken, activeAccountId }),
    [galoyAuthToken, activeAccountId],
  )
  const sessionKeyRef = useRef(sessionKey)
  sessionKeyRef.current = sessionKey
  const isMounted = useIsMounted()

  /** Takes the session of now; the check it hands back says whether the work begun
   *  under it may go on. */
  const captureSession = useCallback((): (() => boolean) => {
    const startedUnder = sessionKeyRef.current
    return () => isMounted() && sessionKeyRef.current === startedUnder
  }, [isMounted])

  return { captureSession }
}
