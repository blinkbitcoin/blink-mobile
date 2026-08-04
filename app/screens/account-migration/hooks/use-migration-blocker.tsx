import React, { createContext, useContext } from "react"

import { useMigrationLock } from "./use-migration-lock"
import { useSelfCustodialDisabled } from "./use-self-custodial-disabled"
import { useWindDownGateArmed } from "./use-wind-down-gate-armed"

type MigrationBlocker = {
  isVisible: boolean
}

/** One shared answer for the two consumers (the container wrapper's deeplink reset and the
 *  primary navigator's gate): separate no-cache reads could disagree and leave a deeplinked
 *  screen operating over a locked account. */
const MigrationBlockerContext = createContext<MigrationBlocker>({ isVisible: false })

/**
 * Decides the forced root blocker, from two independent server signals. The armed gate
 * (post-deadline) replaces the app for every affected account, while the migration lock
 * replaces it for the one account that already started migrating, whatever the deadline
 * says: past the point of no return the custodial account is being emptied, so handing it
 * back would let the user spend a balance the transfer is about to claim. The pre-deadline
 * nudge is neither of those, it stays the home bulletin reached by tapping Migrate, never
 * a screen imposed on launch. The self-custodial disable outranks both: with the stack
 * turned off there is no target to push anyone toward, and a locked user cannot finish a
 * migration whose destination is gone.
 */
const useComputeMigrationBlocker = (): MigrationBlocker => {
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

/** Reads the blocker signals once and shares them, so the two consumers never disagree. */
export const MigrationBlockerProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const blocker = useComputeMigrationBlocker()
  return (
    <MigrationBlockerContext.Provider value={blocker}>
      {children}
    </MigrationBlockerContext.Provider>
  )
}

export const useMigrationBlocker = (): MigrationBlocker =>
  useContext(MigrationBlockerContext)
