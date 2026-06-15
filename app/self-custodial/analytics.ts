/* eslint-disable camelcase */
import analytics from "@react-native-firebase/analytics"

type SelfCustodialBackupCompletedParams = {
  backupMethod: "manual" | "google_drive" | "icloud" | "keychain"
}

export const logSelfCustodialBackupCompleted = (
  params: SelfCustodialBackupCompletedParams,
) => {
  analytics().logEvent("self_custodial_backup_completed", {
    backup_method: params.backupMethod,
  })
}

export const logSelfCustodialRestoreCompleted = () => {
  analytics().logEvent("self_custodial_restore_completed")
}

type SelfCustodialStableBalanceActivatedParams = {
  label: string
}

export const logSelfCustodialStableBalanceActivated = (
  params: SelfCustodialStableBalanceActivatedParams,
) => {
  analytics().logEvent("self_custodial_stable_balance_activated", {
    label: params.label,
  })
}

type SelfCustodialRolloutExposedParams = {
  nonCustodialEnabled: boolean
  stableBalanceEnabled: boolean
  hasCustodialAccount: boolean
}

export const logSelfCustodialRolloutExposed = (
  params: SelfCustodialRolloutExposedParams,
) => {
  analytics().logEvent("self_custodial_rollout_exposed", {
    non_custodial_enabled: params.nonCustodialEnabled,
    stable_balance_enabled: params.stableBalanceEnabled,
    has_custodial_account: params.hasCustodialAccount,
  })
}
