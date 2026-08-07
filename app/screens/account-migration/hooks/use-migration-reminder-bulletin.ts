import { WindDownStatus } from "@app/types/wind-down"

import { useCustodialWindDown } from "./use-custodial-wind-down"

type MigrationReminderBulletin = {
  isVisible: boolean
  deadlineTimestamp: number
  receiveDisabledTimestamp: number
  timezone: string | undefined
}

/**
 * The pre-cutoff reminder: while the custodial account still works normally, a
 * non-dismissible home bulletin reminds the user to migrate before the server-dated
 * deadline. It shows only in the pre-cutoff phase; once receiving is disabled the
 * migrate-now modal takes over, and once the gate arms the blocker takes the whole home.
 * The kill-switch is intentionally NOT checked here: the bulletin's Migrate button routes
 * through the migration entry dispatcher, which enforces the kill-switch before any resume
 * and shows the gate's "temporarily unavailable" screen when disabled, so the single choke
 * point covers the disabled case with no per-entry button logic.
 */
export const useMigrationReminderBulletin = (): MigrationReminderBulletin => {
  const windDown = useCustodialWindDown()
  const isPreCutoff = windDown?.status === WindDownStatus.PreCutoff

  /** The deadline fields are display data for the bulletin, only read while visible. */
  return {
    isVisible: isPreCutoff,
    deadlineTimestamp: windDown?.finalDeadline ?? 0,
    receiveDisabledTimestamp: windDown?.receiveDisabledAt ?? 0,
    timezone: windDown?.timezone,
  }
}
