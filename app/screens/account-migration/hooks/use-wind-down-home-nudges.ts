import { useMigrateNowPrompt } from "./use-migrate-now-prompt"
import { useMigrationReminderBulletin } from "./use-migration-reminder-bulletin"

/**
 * The wind-down nudges the custodial home renders, bundled so the home reads both from
 * one call: the pre-cutoff reminder bulletin and the receive-disabled migrate-now prompt.
 * Each phase shows at most one of them, but the home stays decoupled from the individual
 * wind-down hooks by depending on this single entry point.
 */
export const useWindDownHomeNudges = () => {
  const migrateNowPrompt = useMigrateNowPrompt()
  const reminderBulletin = useMigrationReminderBulletin()

  return { migrateNowPrompt, reminderBulletin }
}
