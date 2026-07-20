import { useCallback, useState } from "react"

import { useCustodialOwnerId } from "./use-custodial-owner-id"

/**
 * Session-scoped dismissal keyed by the real custodial owner: a dismissal made on one
 * profile must not suppress the prompt for another after a switch, so each carries its own
 * mark for the rest of the session. The Galoy account id is the key, since the registry's
 * `custodial-default` is shared across profiles.
 */
export const useAccountSessionDismissal = () => {
  const { ownerId } = useCustodialOwnerId()
  const [dismissedAccountIds, setDismissedAccountIds] = useState<ReadonlySet<string>>(
    new Set(),
  )

  const activeAccountId = ownerId

  const dismissForSession = useCallback(() => {
    if (!activeAccountId) return
    setDismissedAccountIds((previous) => new Set(previous).add(activeAccountId))
  }, [activeAccountId])

  const reopen = useCallback(() => {
    if (!activeAccountId) return
    setDismissedAccountIds((previous) => {
      const next = new Set(previous)
      next.delete(activeAccountId)
      return next
    })
  }, [activeAccountId])

  const isDismissedForSession = activeAccountId
    ? dismissedAccountIds.has(activeAccountId)
    : false

  return { isDismissedForSession, dismissForSession, reopen }
}
