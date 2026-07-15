import { WindDownStatus } from "@app/types/wind-down"

import { useCustodialWindDown } from "./use-custodial-wind-down"

type MigrationReminderBulletin = {
  isVisible: boolean
  deadlineTimestamp: number
  timezone: string | undefined
}

/**
 * The pre-cutoff reminder: while the custodial account still works normally, a
 * non-dismissible home bulletin reminds the user to migrate before the server-dated
 * deadline. It shows only in the pre-cutoff phase; once receiving is disabled the
 * migrate-now modal takes over, and once the gate arms the blocker takes the whole home.
 */
export const useMigrationReminderBulletin = (): MigrationReminderBulletin => {
  const windDown = useCustodialWindDown()
  const isPreCutoff = windDown?.status === WindDownStatus.PreCutoff

  /** The deadline fields are display data for the bulletin, only read while visible. */
  return {
    isVisible: isPreCutoff,
    deadlineTimestamp: windDown?.finalDeadline ?? 0,
    timezone: windDown?.timezone,
  }
}
