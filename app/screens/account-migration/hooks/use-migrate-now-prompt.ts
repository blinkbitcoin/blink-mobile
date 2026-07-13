import { useCallback, useState } from "react"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { AccountType } from "@app/types/wallet"

import { WindDownStatus } from "../utils/backend-mock"

import { useWindDownStatus } from "./use-wind-down-status"

type MigrateNowPrompt = {
  isVisible: boolean
  deadlineTimestamp: number
  timezone: string
  dismissForSession: () => void
}

/** The post-cutoff prompt (FR37): once the server reports receiving disabled, each
 *  session opens with a dismissible push into the migration, dated by the server. */
export const useMigrateNowPrompt = (): MigrateNowPrompt => {
  const [isDismissedForSession, setIsDismissedForSession] = useState(false)
  const dismissForSession = useCallback(() => setIsDismissedForSession(true), [])

  const { accountType } = useActiveWallet()
  const windDown = useWindDownStatus()

  const isReceiveDisabled =
    accountType === AccountType.Custodial &&
    windDown.status === WindDownStatus.ReceiveDisabled

  return {
    isVisible: isReceiveDisabled && !isDismissedForSession,
    deadlineTimestamp: windDown.finalDeadline,
    timezone: windDown.timezone,
    dismissForSession,
  }
}
