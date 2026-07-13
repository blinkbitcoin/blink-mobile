import { useCallback, useState } from "react"

import {
  useCustodialMigrationRequired,
  useCustodialMigrationRequiredSync,
} from "@app/hooks/use-custodial-migration-required"

import { useMigrationGateArmed } from "./use-migration-gate-armed"

type MigrationBlocker = {
  isVisible: boolean
  onClose?: () => void
}

/** Decides the forced root blocker: a forced-cohort account may dismiss it for the
 *  session, while an armed gate ignores the dismissal and offers no close. */
export const useMigrationBlocker = (): MigrationBlocker => {
  const [isDismissedForSession, setIsDismissedForSession] = useState(false)
  const dismissForSession = useCallback(() => setIsDismissedForSession(true), [])

  useCustodialMigrationRequiredSync()
  const isMigrationRequired = useCustodialMigrationRequired()
  const isGateArmed = useMigrationGateArmed()

  if (isGateArmed) return { isVisible: true }

  return {
    isVisible: isMigrationRequired && !isDismissedForSession,
    onClose: dismissForSession,
  }
}
