import { useSelfCustodialDisabled } from "./use-self-custodial-disabled"
import { useWindDownGateArmed } from "./use-wind-down-gate-armed"

type MigrationBlocker = {
  isVisible: boolean
}

/** Decides the forced root blocker. Only the armed gate (post-deadline, server-authoritative)
 *  replaces the app; the pre-deadline nudge is the home bulletin, reached by tapping Migrate,
 *  never a screen imposed on launch. The self-custodial kill-switch outranks the gate: with
 *  the stack disabled by emergency, nobody gets pushed toward a target that is off. */
export const useMigrationBlocker = (): MigrationBlocker => {
  const isSelfCustodialDisabled = useSelfCustodialDisabled()
  const isGateArmed = useWindDownGateArmed()

  if (isSelfCustodialDisabled) return { isVisible: false }
  return { isVisible: isGateArmed }
}
