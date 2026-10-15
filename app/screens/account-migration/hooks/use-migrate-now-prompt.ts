import { WindDown, WindDownStatus } from "@app/types/wind-down"

import { useAccountSessionDismissal } from "./use-account-session-dismissal"
import { useCustodialWindDownRead } from "./use-custodial-wind-down"
import { useSelfCustodialDisabled } from "./use-self-custodial-disabled"
import { WindDownReadOptions } from "./use-wind-down-status"

type MigrateNowRemedy = {
  /** The post-cutoff push into the migration applies to the account: receiving is
   *  disabled and the self-custodial stack is on. */
  isDue: boolean
  isPending: boolean
  windDown: WindDown | null
}

/** Whether the push into the migration applies, before any session dismissal, which the
 *  prompt keeps for itself: what a surface that must yield to the push reads. */
export const useMigrateNowRemedy = (options?: WindDownReadOptions): MigrateNowRemedy => {
  const isSelfCustodialDisabled = useSelfCustodialDisabled()
  const { windDown, isPending } = useCustodialWindDownRead(options)

  const isReceiveDisabled = windDown?.status === WindDownStatus.ReceiveDisabled

  /** Reopening the greyed-Receive nudge only surfaces the prompt when receiving is disabled
   *  and the self-custodial flag is on; the home falls back to a toast otherwise. */
  return { isDue: isReceiveDisabled && !isSelfCustodialDisabled, isPending, windDown }
}

type MigrateNowPrompt = {
  isVisible: boolean
  /** The wind-down has not answered yet, so the prompt may still turn out to be due:
   *  a nudge that must yield to it waits on this rather than on `isVisible` alone. */
  isPending: boolean
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
  const { isDue: canReopen, isPending, windDown } = useMigrateNowRemedy()

  /** The deadline fields are display data for the modal, only read while visible. */
  return {
    isVisible: canReopen && !isDismissedForSession,
    isPending,
    canReopen,
    deadlineTimestamp: windDown?.finalDeadline ?? 0,
    timezone: windDown?.timezone,
    dismissForSession,
    reopen,
  }
}
