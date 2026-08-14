import { useCallback } from "react"

import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

import { useMigrateNowPrompt } from "./use-migrate-now-prompt"
import { useMigrationReminderBulletin } from "./use-migration-reminder-bulletin"
import { useOffboardOnlyBulletin } from "./use-offboard-only-bulletin"
import { useWindDownReceiveBlocked } from "./use-wind-down-receive-blocked"

/**
 * The wind-down nudges the custodial home renders, bundled so the home reads them from one
 * call: the offboard-only withdraw bulletin, the pre-cutoff reminder bulletin, the
 * receive-disabled migrate-now prompt, and the receive-blocked state that greys the home
 * Receive action. The home stays decoupled from the individual wind-down hooks by
 * depending on this single entry point.
 */
export const useWindDownHomeNudges = () => {
  const { LL } = useI18nContext()
  const migrateNowPrompt = useMigrateNowPrompt()
  const reminderBulletin = useMigrationReminderBulletin()
  const offboardBulletin = useOffboardOnlyBulletin()
  const isReceiveBlocked = useWindDownReceiveBlocked()

  /** Both blocked phases grey Receive. A tap reopens the migrate-now nudge when that nudge
   *  can actually surface; when it cannot (the terminal gate, or the self-custodial flag is
   *  off) a toast explains, so the tap is never a silent no-op. Depends on the prompt's
   *  stable members, not the object it recreates each render. */
  const { canReopen, reopen } = migrateNowPrompt
  const onReceiveBlockedPress = useCallback(() => {
    if (canReopen) {
      reopen()
      return
    }
    toastShow({
      message: (translations) => translations.AccountMigration.receivingDisabledToast(),
      type: "warning",
      LL,
    })
  }, [canReopen, reopen, LL])

  return {
    migrateNowPrompt,
    offboardBulletin,
    /** The offboard bulletin replaces the migration reminder rather than stacking with
     *  it: offboard-only regions cannot open any account, so the reminder's Migrate CTA
     *  is a dead end, and two "Important" cards would give contradictory instructions. */
    reminderBulletin: {
      ...reminderBulletin,
      isVisible: reminderBulletin.isVisible && !offboardBulletin.isVisible,
    },
    receiveBlocked: {
      isBlocked: isReceiveBlocked,
      onDisabledPress: onReceiveBlockedPress,
    },
  }
}
