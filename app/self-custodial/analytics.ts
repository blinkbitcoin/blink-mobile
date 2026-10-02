import {
  captureTelemetryFact,
  currentWalletProvider,
  mintTelemetryEventId,
  TelemetryEvent,
  type BackupMethod,
  type TelemetryFact,
} from "@app/telemetry"

/**
 * The four self-custodial events that were already shipping straight to Firebase.
 *
 * They now have rows like everything else, and their rows name both emitting modes, so
 * whether one may be emitted is a fact in `contract.ts` rather than a side effect of the
 * collection switch. These four were parked on `Custodial` for a while, which meant the
 * three that fire inside self-custodial flows were emitted from nowhere at all; a row says
 * so in one place instead.
 *
 * Routing them through the boundary is what makes that true. The gate reads the row, the
 * policy stage checks the domain, and the boundary picks the carrier from the mode — GA4 on
 * Custodial, the outbox on Enhanced. A producer here cannot reach Firebase, cannot pick a
 * carrier, and cannot emit for a mode it may not.
 */

type Common = Pick<TelemetryFact, "telemetryEventId" | "walletProvider">

/**
 * Mints the id and reads the provider for the mode active now, then hands the finished
 * fact to the boundary. No mode, no event: an emission with no `walletProvider` to write is
 * not a partial event, it is one that must not be written at all.
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
