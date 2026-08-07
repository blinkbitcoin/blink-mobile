import { MigrationStatus } from "@app/graphql/generated"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType } from "@app/types/wallet"

import { useMigrationStatus } from "./use-migration-status"

type MigrationLock = {
  isLocked: boolean
  /** Travels with the lock so a caller that would otherwise render the wrong screen can
   *  wait: an unknown lock is not an unlocked one, it is an answer still on its way. */
  loading: boolean
  /** A failed read is not an unlocked account either: it travels too, so the gate can block
   *  with a retry instead of silently re-pitching the intro to a locked user. */
  hasError: boolean
  /** Re-runs the read behind the gate's retry control. */
  refetch: () => Promise<unknown>
}

/**
 * Whether the ACTIVE account is past the migration's point of no return, as the server
 * sees it. This is the whole lock: it survives a reinstall, which the local checkpoint
 * cannot (48h expiry, and AsyncStorage dies with the app), so the checkpoint is demoted
 * to remembering WHICH screen to resume on. The account type comes from the registry, as
 * in the wind-down gate, so a custodial migration never blocks a self-custodial session
 * the user switched to; and only a phase the server actually reported locks, because
 * locking every offline launch into a migration is far worse than letting a locked user
 * browse until the next successful read.
 */
export const useMigrationLock = (): MigrationLock => {
  const { activeAccount } = useAccountRegistry()

  /** Only a custodial account can be mid-migration, so the phase is never even asked for
   *  on a self-custodial launch, whose result would be discarded anyway. */
  const isCustodial = activeAccount?.type === AccountType.Custodial
  const { status, loading, error, refetch } = useMigrationStatus({ skip: !isCustodial })

  if (!isCustodial) {
    return { isLocked: false, loading: false, hasError: false, refetch }
  }

  const isInProgress = status === MigrationStatus.InProgress
  const isTransferring = status === MigrationStatus.Transferring
  /** A failed migration stays locked too: the funds may still settle server-side, so the
   *  account is kept in the flow (routed to support) instead of handed back to spend. */
  const isFailed = status === MigrationStatus.Failed

  return {
    isLocked: isInProgress || isTransferring || isFailed,
    loading,
    hasError: Boolean(error),
    refetch,
  }
}
