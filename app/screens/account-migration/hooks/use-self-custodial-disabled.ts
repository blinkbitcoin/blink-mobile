import { useFeatureFlags } from "@app/config/feature-flags-context"

/**
 * The emergency kill-switch over every entry into the migration: once the remote config
 * has loaded and reports the self-custodial stack disabled, nothing may push the user
 * toward it (there is nothing working to migrate toward). Server-driven wind-down UI
 * like the receive greying stays on regardless, since that reflects account state.
 */
export const useSelfCustodialDisabled = (): boolean => {
  const { nonCustodialEnabled, remoteConfigReady } = useFeatureFlags()
  return remoteConfigReady && !nonCustodialEnabled
}
