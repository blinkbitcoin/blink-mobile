import { useEffect } from "react"

import analytics from "@react-native-firebase/analytics"

import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveActiveSelfCustodialId } from "@app/store/persistent-state/active-self-custodial-account"
import { AccountMode } from "@app/types/account"

import { getTelemetryInstanceId } from "../telemetry-instance-id"

/**
 * Owns GA4's collection switch and telemetry identity for the active account, which is
 * what makes Incognito real rather than a labeling convention: while an Anon account is
 * active, collection is off and no user id is attached, so not even GA4's automatic
 * session events leave the device.
 *
 * Custodial identity (`me.id`) stays with AnalyticsContainer, which skips it while a
 * self-custodial account is active; this hook supplies the Enhanced identity instead, a
 * per-install UUID, and restores nothing on the way back — AnalyticsContainer re-sets
 * `me.id` when the custodial account becomes active again.
 *
 * An unset mode fails closed on identity only: collection stays on because pre-mode
 * accounts were never asked anything, but no user id is attached until the mode sync
 * settles one.
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

  useEffect(() => {
    if (!activeSelfCustodialId) {
      analytics().setAnalyticsCollectionEnabled(true)
      analytics().setUserProperty("account_mode", "custodial")
      return
    }
    if (mode === AccountMode.Anon) {
      /** Identity off first, collection second: nothing already queued keeps the id. */
      analytics().setUserId(null)
      analytics().setAnalyticsCollectionEnabled(false)
      return
    }
    if (mode === AccountMode.Enhanced) {
      analytics().setAnalyticsCollectionEnabled(true)
      analytics().setUserProperty("account_mode", "enhanced")
      getTelemetryInstanceId().then((id) => analytics().setUserId(id))
      return
    }
    analytics().setAnalyticsCollectionEnabled(true)
    analytics().setUserId(null)
  }, [activeSelfCustodialId, mode])
}
