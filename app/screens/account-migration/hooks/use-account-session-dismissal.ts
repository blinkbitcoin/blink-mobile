import { useCallback, useState } from "react"

import { useCustodialOwnerId } from "./use-custodial-owner-id"

/**
 * Session-scoped dismissal keyed by the real custodial owner: a dismissal made on one
 * profile must not suppress the prompt for another after a switch, so each carries its own
 * mark for the rest of the session. The Galoy account id is the key, since the registry's
 * `custodial-default` is shared across profiles.
 */
/** Fallback key while the owner id has not resolved (e.g. the owner query is offline): the
 *  prompt can still be dismissed for the session, and per-profile keying takes over once the
 *  real owner arrives. Galoy account ids never collide with this sentinel. */
const SESSION_GLOBAL_KEY = "session-global"

export const useAccountSessionDismissal = () => {
  const { ownerId } = useCustodialOwnerId()
  const [dismissedAccountIds, setDismissedAccountIds] = useState<ReadonlySet<string>>(
    new Set(),
  )

  const activeAccountId = ownerId ?? SESSION_GLOBAL_KEY

  const dismissForSession = useCallback(() => {
    setDismissedAccountIds((previous) => new Set(previous).add(activeAccountId))
  }, [activeAccountId])

  const reopen = useCallback(() => {
    setDismissedAccountIds((previous) => {
      const next = new Set(previous)
      next.delete(activeAccountId)
      return next
    })
  }, [activeAccountId])

  const isDismissedForSession = dismissedAccountIds.has(activeAccountId)

  return { isDismissedForSession, dismissForSession, reopen }
}
