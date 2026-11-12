import { useEffect } from "react"

import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveActiveSelfCustodialId } from "@app/store/persistent-state/active-self-custodial-account"
import { AccountMode } from "@app/types/account"

import { AnalyticsDomain, setAnalyticsDomain } from "../analytics-identity"

const domainFor = (
  activeSelfCustodialId: string | null,
  mode: AccountMode | null,
): AnalyticsDomain => {
  if (!activeSelfCustodialId) return AnalyticsDomain.Custodial
  if (mode === AccountMode.Anon) return AnalyticsDomain.Anon
  if (mode === AccountMode.Enhanced) return AnalyticsDomain.Enhanced
  return AnalyticsDomain.Unset
}

/**
 * Tells GA4's identity owner (`analytics-identity`) which account is active, which is
 * what makes Incognito real rather than a labeling convention: while an Anon account is
 * active, collection is off and no user id is attached, so not even GA4's automatic
 * session events leave the device. Enhanced reports a per-install UUID on a fresh
 * app instance, never the custodial `me.id`.
 */
export const useAnalyticsCollectionGate = (): void => {
  const { persistentState } = usePersistentStateContext()
  const activeSelfCustodialId = persistentState
    ? resolveActiveSelfCustodialId(persistentState)
    : null
  const mode = activeSelfCustodialId
    ? persistentState?.selfCustodialAccountModeByAccountId?.[activeSelfCustodialId] ??
      null
    : null
  const domain = domainFor(activeSelfCustodialId, mode)

  useEffect(() => {
    setAnalyticsDomain(domain)
  }, [domain])
}
