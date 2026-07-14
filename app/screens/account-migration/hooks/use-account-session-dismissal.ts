import { useCallback, useState } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"

/**
 * Session-scoped dismissal keyed by account: a dismissal made on one account must not
 * suppress the prompt for another one after a profile switch, so each account carries
 * its own mark for the rest of the session.
 */
export const useAccountSessionDismissal = () => {
  const { activeAccount } = useAccountRegistry()
  const [dismissedAccountIds, setDismissedAccountIds] = useState<ReadonlySet<string>>(
    new Set(),
  )

  const activeAccountId = activeAccount?.id ?? null

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
