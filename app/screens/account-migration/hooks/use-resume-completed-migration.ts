import { useEffect, useRef } from "react"

import { MigrationStatus } from "@app/graphql/generated"
import { reportError } from "@app/utils/error-logging"

import { useCompleteMigration } from "./use-complete-migration"
import { useMigrationStatus } from "./use-migration-status"

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

  const hasResumedRef = useRef(false)
  const isSwapPending =
    status === MigrationStatus.Completed && hasUnfinishedMigration && !migrationLoading

  useEffect(() => {
    if (!isSwapPending || hasResumedRef.current) return

    /** Claimed once per launch: the swap discards a session and cannot be half-run. */
    hasResumedRef.current = true
    completeMigration().catch((err) => {
      reportError("Migration resume swap", err)
    })
  }, [isSwapPending, completeMigration])
}
