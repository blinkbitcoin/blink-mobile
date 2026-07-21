import { WindDownStatus } from "@app/types/wind-down"

import { useAccountSessionDismissal } from "./use-account-session-dismissal"
import { useCustodialWindDown } from "./use-custodial-wind-down"
import { useSelfCustodialDisabled } from "./use-self-custodial-disabled"

type MigrateNowPrompt = {
  isVisible: boolean
  canReopen: boolean
  deadlineTimestamp: number
  timezone: string | undefined
  dismissForSession: () => void
  reopen: () => void
}

/** The post-cutoff prompt: once the server reports receiving disabled, each
 *  session opens with a dismissible push into the migration, dated by the server.
 *  The same state greys out the home Receive action, whose tap reopens the prompt. */
export const useMigrateNowPrompt = (): MigrateNowPrompt => {
  const { isDismissedForSession, dismissForSession, reopen } =
    useAccountSessionDismissal()
  const isSelfCustodialDisabled = useSelfCustodialDisabled()

  const windDown = useCustodialWindDown()

  const isReceiveDisabled = windDown?.status === WindDownStatus.ReceiveDisabled

  /** Reopening the greyed-Receive nudge only surfaces the prompt when receiving is disabled
   *  and the self-custodial flag is on; the home falls back to a toast otherwise. */
  const canReopen = isReceiveDisabled && !isSelfCustodialDisabled

  /** The deadline fields are display data for the modal, only read while visible. */
  return {
    isVisible: canReopen && !isDismissedForSession,
    canReopen,
    deadlineTimestamp: windDown?.finalDeadline ?? 0,
    timezone: windDown?.timezone,
    dismissForSession,
    reopen,
  }
}
