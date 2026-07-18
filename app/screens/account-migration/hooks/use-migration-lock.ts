import { MigrationStatus } from "@app/graphql/generated"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType } from "@app/types/wallet"

import { useMigrationStatus } from "./use-migration-status"

type MigrationLock = {
  isLocked: boolean
  /** Travels with the lock so a caller that would otherwise render the wrong screen can
   *  wait: an unknown lock is not an unlocked one, it is an answer still on its way. */
  loading: boolean
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
  const { status, loading } = useMigrationStatus()

  if (activeAccount?.type !== AccountType.Custodial) {
    return { isLocked: false, loading: false }
  }

  const isInProgress = status === MigrationStatus.InProgress
  const isTransferring = status === MigrationStatus.Transferring

  return { isLocked: isInProgress || isTransferring, loading }
}
