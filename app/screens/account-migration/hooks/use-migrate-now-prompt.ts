import { WindDownStatus } from "../utils/backend-mock"

import { useAccountSessionDismissal } from "./use-account-session-dismissal"
import { useCustodialWindDown } from "./use-custodial-wind-down"

type MigrateNowPrompt = {
  isVisible: boolean
  isReceiveDisabled: boolean
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

  const windDown = useCustodialWindDown()

  const isReceiveDisabled = windDown?.status === WindDownStatus.ReceiveDisabled

  /** The deadline fields are display data for the modal, only read while visible. */
  return {
    isVisible: isReceiveDisabled && !isDismissedForSession,
    isReceiveDisabled,
    deadlineTimestamp: windDown?.finalDeadline ?? 0,
    timezone: windDown?.timezone,
    dismissForSession,
    reopen,
  }
}
