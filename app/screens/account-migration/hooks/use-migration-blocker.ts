import { useMigrationLock } from "./use-migration-lock"
import { useSelfCustodialDisabled } from "./use-self-custodial-disabled"
import { useWindDownGateArmed } from "./use-wind-down-gate-armed"

type MigrationBlocker = {
  isVisible: boolean
}

/**
 * Decides the forced root blocker, from two independent server signals. The armed gate
 * (post-deadline) replaces the app for every affected account, while the migration lock
 * replaces it for the one account that already started migrating, whatever the deadline
 * says: past the point of no return the custodial account is being emptied, so handing it
 * back would let the user spend a balance the transfer is about to claim. The pre-deadline
 * nudge is neither of those, it stays the home bulletin reached by tapping Migrate, never
 * a screen imposed on launch. The self-custodial kill-switch outranks both: with the stack
 * disabled by emergency there is no target to push anyone toward, and a locked user cannot
 * finish a migration whose destination is switched off.
 */
export const useMigrationBlocker = (): MigrationBlocker => {
  const isSelfCustodialDisabled = useSelfCustodialDisabled()
  const isGateArmed = useWindDownGateArmed()

  /** Deliberately ignores the lock's loading: waiting here would put a spinner in front
   *  of every custodial launch to spare the rare unlocked user a frame of the app they
   *  are entitled to. The gate below waits, because it would render the wrong screen. */
  const { isLocked } = useMigrationLock()

  if (isSelfCustodialDisabled) return { isVisible: false }

  const isBlocking = isGateArmed || isLocked
  return { isVisible: isBlocking }
}
