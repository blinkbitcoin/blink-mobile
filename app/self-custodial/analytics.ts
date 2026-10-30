/* eslint-disable camelcase */
import analytics from "@react-native-firebase/analytics"

import { measure, measureFor, ScEvent, type MeasureTarget } from "./measurement"

type SelfCustodialBackupCompletedParams = {
  backupMethod: "manual" | "google_drive" | "icloud" | "keychain"
}

/** Gated: a backup made under Incognito, or before any mode exists, leaves no event. */
export const logSelfCustodialBackupCompleted = (
  params: SelfCustodialBackupCompletedParams,
) => {
  measure(ScEvent.BackupCompleted, { backup_method: params.backupMethod })
}

/** Restores happen before the account is active, so the caller names the account and
 *  the mode the restore itself established (the server's answer, or the stored mode of
 *  an account already on the device); an unknown mode suppresses the event. */
export const logSelfCustodialRestoreCompleted = (target: MeasureTarget) => {
  measureFor(target, ScEvent.RestoreCompleted)
}

type SelfCustodialStableBalanceActivatedParams = {
  label: string
}

export const logSelfCustodialStableBalanceActivated = (
  params: SelfCustodialStableBalanceActivatedParams,
) => {
  measure(ScEvent.StableBalanceActivated, { label: params.label })
}

type SelfCustodialRolloutExposedParams = {
  nonCustodialEnabled: boolean
  stableBalanceEnabled: boolean
  hasCustodialAccount: boolean
}

/** Rollout exposure is a custodial-context signal — it measures what existing users are
 *  shown, before any self-custodial account or mode exists — so it stays ungated. */
export const logSelfCustodialRolloutExposed = (
  params: SelfCustodialRolloutExposedParams,
) => {
  analytics().logEvent("self_custodial_rollout_exposed", {
    non_custodial_enabled: params.nonCustodialEnabled,
    stable_balance_enabled: params.stableBalanceEnabled,
    has_custodial_account: params.hasCustodialAccount,
  })
}
