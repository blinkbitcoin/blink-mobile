import {
  captureTelemetryFact,
  currentWalletProvider,
  mintTelemetryEventId,
  TelemetryEvent,
  WalletProvider,
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

/**
 * Facts about an account that is not active yet, held until it is.
 *
 * A restore logs straight after it asks for the restored account to become active, and that
 * request is a queued state update: at the moment of the call the mode is still the previous
 * account's. Emitted then, a restore from a custodial session went to GA4 under the ledger
 * account id — the one join the privacy ruling still forbids — and one from another
 * self-custodial account was filed in that account's outbox. So the fact waits for the
 * telemetry mount to report that its account is active and its mode has settled.
 *
 * A held fact is emitted only if that account then resolves Enhanced; under incognito or no
 * mode it is dropped, as it would have been had the account been active all along. The list
 * is bounded: a fact whose account never activates in this process is not worth keeping.
 */
type DeferredFact = { accountId: string; build: (common: Common) => TelemetryFact }
const DEFERRED_FACTS_MAX = 8
let deferredFacts: DeferredFact[] = []

const emitOnceActive = (accountId: string, build: DeferredFact["build"]): void => {
  deferredFacts.push({ accountId, build })
  if (deferredFacts.length > DEFERRED_FACTS_MAX) deferredFacts.shift()
}

/** Called by the telemetry mount once `accountId` is active and its mode has settled. */
export const flushDeferredTelemetry = (accountId: string): void => {
  const due = deferredFacts.filter((fact) => fact.accountId === accountId)
  if (due.length === 0) return
  deferredFacts = deferredFacts.filter((fact) => fact.accountId !== accountId)
  if (currentWalletProvider() !== WalletProvider.Spark) return
  for (const fact of due) emit(fact.build)
}

export const resetDeferredTelemetryForTesting = (): void => {
  deferredFacts = []
}

export const logSelfCustodialRestoreCompleted = (params: { accountId: string }): void => {
  emitOnceActive(params.accountId, (common) => ({
    ...common,
    event: TelemetryEvent.RestoreCompleted,
  }))
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
