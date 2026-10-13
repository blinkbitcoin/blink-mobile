import { MigrationStatus } from "@app/graphql/generated"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { ServerMigrationFlow } from "@app/types/migration"
import { AccountType } from "@app/types/wallet"

import { useMigrationStatus } from "./use-migration-status"

type MigrationLock = {
  isLocked: boolean
  /** What a commit-point checkpoint should do given the server's answer. Unlocked is not
   *  one answer but two: a migration that never started (or support cleared) and one that
   *  completed while this device still waits to swap into its wallet. They need opposite
   *  handling, so the routing reads this rather than the lock. */
  flow: ServerMigrationFlow
  /** Travels with the lock so a caller that would otherwise render the wrong screen can
   *  wait: an unknown lock is not an unlocked one, it is an answer still on its way. */
  loading: boolean
  /** A failed read is not an unlocked account either: it travels too, so the gate can block
   *  with a retry instead of silently re-pitching the intro to a locked user. */
  hasError: boolean
  /** Re-runs the read behind the gate's retry control. */
  refetch: () => Promise<unknown>
}

/** Exhaustive on purpose: a phase the server adds has no entry here and fails to compile,
 *  so it is decided deliberately rather than falling into whichever branch is nearest. */
const FLOW_BY_STATUS: Record<MigrationStatus, ServerMigrationFlow> = {
  [MigrationStatus.InProgress]: ServerMigrationFlow.Open,
  [MigrationStatus.Transferring]: ServerMigrationFlow.Open,
  [MigrationStatus.Failed]: ServerMigrationFlow.Open,
  [MigrationStatus.NotStarted]: ServerMigrationFlow.NotStarted,
  [MigrationStatus.Completed]: ServerMigrationFlow.Completed,
}

/** A failed re-read can leave the previous answer in place, so a status is only an answer
 *  while the read that carries it is current. */
const resolveServerFlow = (
  status: MigrationStatus | null,
  hasError: boolean,
): ServerMigrationFlow => {
  if (hasError) return ServerMigrationFlow.Unanswered
  if (status === null) return ServerMigrationFlow.Unanswered
  return FLOW_BY_STATUS[status]
}

/**
 * Whether the ACTIVE account is past the migration's point of no return, as the server
 * sees it. This is the whole lock: it survives a reinstall, which the local checkpoint
 * cannot (AsyncStorage dies with the app), so the checkpoint is demoted to remembering
 * WHICH screen to resume on and this answers WHETHER there is still a flow to resume.
 *
 * The account type comes from the registry, as in the wind-down gate, so a custodial
 * migration never blocks a self-custodial session the user switched to; and only a phase
 * the server actually reported locks, because locking every offline launch into a
 * migration is far worse than letting a locked user browse until the next successful read.
 */
export const useMigrationLock = (): MigrationLock => {
  const { activeAccount, loading: registryLoading } = useAccountRegistry()

  /** Only a custodial account can be mid-migration, so the phase is never even asked for
   *  on a self-custodial launch, whose result would be discarded anyway. */
  const isCustodial = activeAccount?.type === AccountType.Custodial
  const { status, loading, error, refetch } = useMigrationStatus({ skip: !isCustodial })

  /** Never asked, so never answered: a self-custodial session neither resumes nor
   *  restarts a custodial flow on the strength of a read that did not run. An unhydrated
   *  registry has no active account yet either, which is not a self-custodial session but
   *  an answer still on its way, so it reports loading rather than a missing answer. */
  if (!isCustodial) {
    return {
      isLocked: false,
      flow: ServerMigrationFlow.Unanswered,
      loading: registryLoading,
      hasError: false,
      refetch,
    }
  }

  const isInProgress = status === MigrationStatus.InProgress
  const isTransferring = status === MigrationStatus.Transferring
  /** A failed migration stays locked too: the funds may still settle server-side, so the
   *  account is kept in the flow (routed to support) instead of handed back to spend. */
  const isFailed = status === MigrationStatus.Failed
  const hasError = Boolean(error)

  return {
    isLocked: isInProgress || isTransferring || isFailed,
    flow: resolveServerFlow(status, hasError),
    loading,
    hasError,
    refetch,
  }
}
