import { useCallback } from "react"

import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

import { useMigrateNowPrompt } from "./use-migrate-now-prompt"
import { useMigrationReminderBulletin } from "./use-migration-reminder-bulletin"
import { useWindDownReceiveBlocked } from "./use-wind-down-receive-blocked"

/**
 * The wind-down nudges the custodial home renders, bundled so the home reads them from one
 * call: the pre-cutoff reminder bulletin, the receive-disabled migrate-now prompt, and the
 * receive-blocked state that greys the home Receive action. The home stays decoupled from
 * the individual wind-down hooks by depending on this single entry point.
 */
export const useWindDownHomeNudges = () => {
  const { LL } = useI18nContext()
  const migrateNowPrompt = useMigrateNowPrompt()
  const reminderBulletin = useMigrationReminderBulletin()
  const isReceiveBlocked = useWindDownReceiveBlocked()

  /** Both blocked phases grey Receive. The receive-disabled phase reopens the migrate-now
   *  nudge; the terminal gate (reachable on the home only with the kill-switch on) has no
   *  nudge, so a tap explains with a toast instead of silently bouncing off the gate.
   *  Depends on the prompt's stable members, not the object it recreates each render. */
  const { isReceiveDisabled, reopen } = migrateNowPrompt
  const onReceiveBlockedPress = useCallback(() => {
    if (isReceiveDisabled) {
      reopen()
      return
    }
    toastShow({
      message: (translations) => translations.AccountMigration.receivingDisabledToast(),
      type: "warning",
      LL,
    })
  }, [isReceiveDisabled, reopen, LL])

  return {
    migrateNowPrompt,
    reminderBulletin,
    receiveBlocked: {
      isBlocked: isReceiveBlocked,
      onDisabledPress: onReceiveBlockedPress,
    },
  }
}
