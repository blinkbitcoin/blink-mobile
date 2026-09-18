import {
  captureTelemetryFact,
  currentWalletProvider,
  mintTelemetryEventId,
  TelemetryEvent,
  type BackupMethod,
  type TelemetryFact,
} from "@app/telemetry"

/**
 * The four self-custodial events that were already shipping straight to Firebase (AD-24).
 *
 * None is in the three-event settlement contract, so FR-70's collection toggle would have
 * silenced them on Enhanced devices the day P2 shipped — and silenced them *silently*, as a
 * side effect of a switch rather than as a decision. AD-24's ruling is that each goes to
 * privacy review case by case with admission expected, and that its status is a contract
 * fact: a row in `contract.ts` with a `modes` column. Until a row passes review it is
 * restricted to `Custodial`, which is the outcome AD-24 names for a row that fails, so the
 * behaviour on Enhanced is the same as before P2 and now says so in one place.
 *
 * Routing them through the boundary is what makes that true. The gate reads the row, the
 * policy stage checks the domain, and the boundary picks the carrier from the mode —
 * GA4 on Custodial (CD-7), the outbox on Enhanced once a row is admitted. A producer here
 * cannot reach Firebase, cannot pick a carrier, and cannot emit for a mode it may not.
 */

type Common = Pick<TelemetryFact, "telemetryEventId" | "walletProvider">

/**
 * Mints the id and reads the provider for the mode active now, then hands the finished
 * fact to the boundary. No mode, no event: an emission with no `walletProvider` to write is
 * not a partial event, it is one AD-20 says must not be written at all.
 */
const emit = (build: (common: Common) => TelemetryFact): void => {
  const walletProvider = currentWalletProvider()
  if (!walletProvider) return
  captureTelemetryFact(
    build({ telemetryEventId: mintTelemetryEventId(), walletProvider }),
  )
}

export const logSelfCustodialBackupCompleted = (params: {
  backupMethod: BackupMethod
}): void => {
  emit((common) => ({
    ...common,
    event: TelemetryEvent.BackupCompleted,
    backupMethod: params.backupMethod,
  }))
}

export const logSelfCustodialRestoreCompleted = (): void => {
  emit((common) => ({ ...common, event: TelemetryEvent.RestoreCompleted }))
}

export const logSelfCustodialStableBalanceActivated = (params: {
  label: "USDB"
}): void => {
  emit((common) => ({
    ...common,
    event: TelemetryEvent.StableBalanceActivated,
    label: params.label,
  }))
}

export const logSelfCustodialRolloutExposed = (params: {
  nonCustodialEnabled: boolean
  stableBalanceEnabled: boolean
  hasCustodialAccount: boolean
}): void => {
  emit((common) => ({
    ...common,
    event: TelemetryEvent.RolloutExposed,
    nonCustodialEnabled: params.nonCustodialEnabled,
    stableBalanceEnabled: params.stableBalanceEnabled,
    hasCustodialAccount: params.hasCustodialAccount,
  }))
}
