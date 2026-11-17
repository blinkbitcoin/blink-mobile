import { useFeatureFlags } from "@app/config/feature-flags-context"

/**
 * The emergency kill-switch over every entry into the migration: once the remote config
 * has loaded and reports the self-custodial stack disabled, nothing may push the user
 * toward it (there is nothing working to migrate toward). Server-driven wind-down UI
 * like the receive greying stays on regardless, since that reflects account state. Only
 * the console's word enables it: the shipped default is on so a first launch can still
 * offer a new self-custodial wallet, but a migration moves funds, and must not follow a
 * default the console may already have switched off.
 */
export const useSelfCustodialDisabled = (): boolean => {
  const { nonCustodialEnabled, remoteConfigReady, isNonCustodialFlagSettled } =
    useFeatureFlags()
  const isEnabledByConsole = isNonCustodialFlagSettled && nonCustodialEnabled
  return remoteConfigReady && !isEnabledByConsole
}
