import { useEffect, useRef, useState } from "react"

import { MigrationStatus } from "@app/graphql/generated"
import { reportError } from "@app/utils/error-logging"

import { useCompleteMigration } from "./use-complete-migration"
import { useMigrationStatus } from "./use-migration-status"

/** A transient swap failure (a briefly locked keystore) can clear on a retry, so a few
 *  are attempted before leaving the rest to the next launch, which starts the count over. */
const MAX_SWAP_ATTEMPTS = 3

/**
 * Finishes a migration the server completed but this device never swapped away from. The
 * transfer ends in two steps, the server moving the funds and the app switching sessions,
 * and only the transfer screen watches for the first. An app killed between them would
 * otherwise open on the emptied custodial account with the funded wallet sitting unused
 * in the switcher, at the worst possible moment for the user to be told nothing. The
 * server is only asked when a checkpoint says this device has a migration to finish, so
 * nobody else pays for a question they cannot act on.
 */
export const useResumeCompletedMigration = (): void => {
  const { migrationAccountId, migrationLoading, completeMigration } =
    useCompleteMigration()

  const hasUnfinishedMigration = Boolean(migrationAccountId)
  const { status } = useMigrationStatus({ skip: !hasUnfinishedMigration })

  const [attempts, setAttempts] = useState(0)
  const isSwapInFlightRef = useRef(false)
  const isSwapPending =
    status === MigrationStatus.Completed && hasUnfinishedMigration && !migrationLoading

  useEffect(() => {
    const canAttempt = isSwapPending && attempts < MAX_SWAP_ATTEMPTS
    if (!canAttempt || isSwapInFlightRef.current) return

    /** One swap in flight at a time: it discards a session and cannot be half-run. A
     *  failure bumps the count, which both re-runs this effect for the retry and stops it
     *  once the attempts are spent. */
    isSwapInFlightRef.current = true
    completeMigration()
      .catch((err) => {
        reportError("Migration resume swap", err)
        setAttempts((previous) => previous + 1)
      })
      .finally(() => {
        isSwapInFlightRef.current = false
      })
  }, [isSwapPending, attempts, completeMigration])
}
