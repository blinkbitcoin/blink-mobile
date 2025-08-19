import * as React from "react"
import { useApolloClient } from "@apollo/client"

import {
  useUpgradeModalLastShownAtQuery,
  useSessionCountQuery,
} from "@app/graphql/generated"
import { setUpgradeModalLastShownAt } from "@app/graphql/client-only-query"

interface UseAutoShowUpgradeModalReturn {
  canShowUpgradeModal: boolean
  lastShownUpgradeModalAt: string | null
  markShownUpgradeModal: () => void
}

interface UseAutoShowUpgradeModalOptions {
  cooldownDays?: number
  enabled?: boolean
}

export const useAutoShowUpgradeModal = (
  options: UseAutoShowUpgradeModalOptions = {},
): UseAutoShowUpgradeModalReturn => {
  const { cooldownDays = 7, enabled = true } = options
  const client = useApolloClient()

  const { data } = useUpgradeModalLastShownAtQuery({
    fetchPolicy: "cache-first",
    skip: !enabled,
  })

  const { data: sessionData } = useSessionCountQuery({
    fetchPolicy: "cache-first",
    skip: !enabled,
  })

  const lastShownAt = data?.upgradeModalLastShownAt ?? null
  const sessions = sessionData?.sessionCount ?? 0

  const canShowUpgradeModal = React.useMemo(() => {
    if (!enabled || sessions < 2) return false
    if (!lastShownAt) return true

    const last = new Date(lastShownAt).getTime()
    return Date.now() - last >= cooldownDays * 24 * 60 * 60 * 1000
  }, [enabled, sessions, lastShownAt, cooldownDays])

  const markShownUpgradeModal = React.useCallback(() => {
    if (!enabled) return

    setUpgradeModalLastShownAt(client, new Date().toISOString())
  }, [client, enabled])

  return {
    canShowUpgradeModal,
    lastShownUpgradeModalAt: lastShownAt,
    markShownUpgradeModal,
  }
}
