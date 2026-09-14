import { WindDownStatus } from "@app/types/wind-down"

import { useCustodialWindDown } from "./use-custodial-wind-down"

type MigrationReminderBulletin = {
  isVisible: boolean
  /** The phase the bulletin's copy speaks to; only read while visible. */
  phase: WindDownStatus
  deadlineTimestamp: number
  receiveDisabledTimestamp: number
  timezone: string | undefined
}

/**
 * The migration reminder: a non-dismissible home bulletin pointing at the guided migration,
 * shown through both phases where the user can still act on it. Pre-cutoff the account works
 * normally and the bulletin is the only nudge; once receiving is disabled the migrate-now
 * modal fires too, but that modal is dismissible for the session and leaves the dashboard
 * with no entry behind it, so the bulletin stays as the permanent path. Once the gate arms
 * the blocker takes the whole home and there is no dashboard left to hold a bulletin.
 * The kill-switch is intentionally NOT checked here: the bulletin's Migrate button routes
 * through the migration entry dispatcher, which enforces the kill-switch before any resume
 * and shows the gate's "temporarily unavailable" screen when disabled, so the single choke
 * point covers the disabled case with no per-entry button logic.
 */
export const useMigrationReminderBulletin = (): MigrationReminderBulletin => {
  const windDown = useCustodialWindDown()
  const isPreCutoff = windDown?.status === WindDownStatus.PreCutoff
  const isReceiveDisabled = windDown?.status === WindDownStatus.ReceiveDisabled
  const isReminderPhase = isPreCutoff || isReceiveDisabled

  /** Reports the pre-cutoff phase while hidden, where no copy reads it. */
  const phase = isReceiveDisabled
    ? WindDownStatus.ReceiveDisabled
    : WindDownStatus.PreCutoff

  /** The deadline fields are display data for the bulletin, only read while visible. */
  return {
    isVisible: isReminderPhase,
    phase,
    deadlineTimestamp: windDown?.finalDeadline ?? 0,
    receiveDisabledTimestamp: windDown?.receiveDisabledAt ?? 0,
    timezone: windDown?.timezone,
  }
}
