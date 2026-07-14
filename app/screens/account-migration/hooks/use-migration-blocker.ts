import {
  useCustodialMigrationRequired,
  useCustodialMigrationRequiredSync,
} from "@app/hooks/use-custodial-migration-required"

import { useAccountSessionDismissal } from "./use-account-session-dismissal"
import { useSelfCustodialDisabled } from "./use-self-custodial-disabled"
import { useWindDownGateArmed } from "./use-wind-down-gate-armed"

type MigrationBlocker = {
  isVisible: boolean
  onClose?: () => void
}

/** Decides the forced root blocker: a forced-cohort account may dismiss it for the
 *  session, while an armed gate ignores the dismissal and offers no close. The
 *  self-custodial kill-switch outranks everything: with it off, nobody gets pushed
 *  to migrate toward a stack that is disabled by emergency. */
export const useMigrationBlocker = (): MigrationBlocker => {
  const { isDismissedForSession, dismissForSession } = useAccountSessionDismissal()
  const isSelfCustodialDisabled = useSelfCustodialDisabled()

  useCustodialMigrationRequiredSync()
  const isMigrationRequired = useCustodialMigrationRequired()
  const isGateArmed = useWindDownGateArmed()

  if (isSelfCustodialDisabled) return { isVisible: false }

  if (isGateArmed) return { isVisible: true }

  return {
    isVisible: isMigrationRequired && !isDismissedForSession,
    onClose: dismissForSession,
  }
}
