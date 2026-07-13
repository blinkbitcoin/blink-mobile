import { useCallback, useState } from "react"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { AccountType } from "@app/types/wallet"

import { WindDownStatus } from "../utils/backend-mock"

import { useWindDownStatus } from "./use-wind-down-status"

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
  const [isDismissedForSession, setIsDismissedForSession] = useState(false)
  const dismissForSession = useCallback(() => setIsDismissedForSession(true), [])
  const reopen = useCallback(() => setIsDismissedForSession(false), [])

  const { accountType } = useActiveWallet()
  const windDown = useWindDownStatus()

  const isReceiveDisabled =
    accountType === AccountType.Custodial &&
    windDown?.status === WindDownStatus.ReceiveDisabled

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
