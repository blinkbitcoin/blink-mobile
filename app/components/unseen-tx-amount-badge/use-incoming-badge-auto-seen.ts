import { useEffect, useRef, useState } from "react"

import { WalletCurrency } from "@app/graphql/generated"

const EXIT_ANIMATION_MS = 180

/**
 * Auto-marks an incoming transaction badge as seen after a delay,
 * provided the home screen is focused. This mirrors the outgoing badge
 * behaviour where the badge disappears automatically, except the
 * incoming badge lingers a little longer so the user can notice it.
 *
 * Returns a `visible` flag that drives the exit animation: it goes
 * false before markTxSeen runs, giving the drop-out animation time
 * to play.
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
  const [visible, setVisible] = useState(true)
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
    setVisible(true)

    let seenTimeout: ReturnType<typeof setTimeout> | undefined

    const hideTimeout = setTimeout(() => {
      setVisible(false)
      seenTimeout = setTimeout(() => {
        markTxSeen(unseenCurrency)
        scheduledRef.current = undefined
      }, EXIT_ANIMATION_MS)
    }, delayMs)

    return () => {
      clearTimeout(hideTimeout)
      if (seenTimeout !== undefined) clearTimeout(seenTimeout)
      scheduledRef.current = undefined
    }
  }, [isFocused, isOutgoing, unseenCurrency, delayMs, markTxSeen])

  return visible
}
