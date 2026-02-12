import { useEffect, useRef } from "react"

import { WalletCurrency } from "@app/graphql/generated"

/**
 * Auto-marks an incoming transaction badge as seen after a delay,
 * provided the home screen is focused. This mirrors the outgoing badge
 * behaviour where the badge disappears automatically, except the
 * incoming badge lingers a little longer so the user can notice it.
 */
export const useIncomingBadgeAutoSeen = ({
  isFocused,
  isOutgoing,
  unseenCurrency,
  delayMs = 5000,
  markTxSeen,
}: {
  isFocused: boolean
  isOutgoing: boolean | undefined
  unseenCurrency: WalletCurrency | undefined
  delayMs?: number
  markTxSeen: (currency: WalletCurrency) => void
}) => {
  // Track which currency we already scheduled a mark-seen for so we
  // don't re-trigger on every render.
  const scheduledRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    // Only auto-dismiss incoming transactions
    if (isOutgoing || isOutgoing === undefined) return
    if (!isFocused) return
    if (!unseenCurrency) return

    // Don't re-schedule for the same currency that's already pending
    if (scheduledRef.current === unseenCurrency) return

    scheduledRef.current = unseenCurrency

    const timeout = setTimeout(() => {
      markTxSeen(unseenCurrency)
      scheduledRef.current = undefined
    }, delayMs)

    return () => {
      clearTimeout(timeout)
      scheduledRef.current = undefined
    }
  }, [isFocused, isOutgoing, unseenCurrency, delayMs, markTxSeen])
}
