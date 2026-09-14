import { useEffect, useState } from "react"

import { AMOUNT_BADGE_ANIMATION } from "./amount-badge"

export type BadgeSlotContent = "unseen" | "pending" | "none"

/** How long the transient badge may keep the slot for one transaction. Matches
 *  the auto-dismiss windows in `useOutgoingBadgeVisibility` /
 *  `useIncomingBadgeAutoSeen`, but is enforced here independently: a stuck
 *  seen-state must not cost the pending deposit its slot forever. */
const UNSEEN_HOLD_MS = 5_000

/**
 * One slot, two tenants. The transient unseen-transaction badge outranks the
 * persistent pending-deposit row while it is on screen — plus `durationOut`
 * after it hides, so its drop-out animation finishes instead of being cut — and
 * for no longer than one hold window per transaction, after which the pending
 * row takes the slot back.
 */
export const useBadgeSlotContent = ({
  showUnseenBadge,
  hasPendingAmount,
  unseenKey,
  holdMs = UNSEEN_HOLD_MS,
}: {
  showUnseenBadge: boolean
  hasPendingAmount: boolean
  /** Identity of the transaction the transient badge is announcing; a new one
   *  earns a fresh hold window. */
  unseenKey?: string
  holdMs?: number
}): BadgeSlotContent => {
  const [unseenHeld, setUnseenHeld] = useState(showUnseenBadge)
  const [holdExpired, setHoldExpired] = useState(false)

  useEffect(() => {
    if (showUnseenBadge) {
      setUnseenHeld(true)
      return
    }

    const timeout = setTimeout(() => {
      setUnseenHeld(false)
    }, AMOUNT_BADGE_ANIMATION.durationOut)

    return () => clearTimeout(timeout)
  }, [showUnseenBadge])

  /** A new transaction earns a fresh window. The previous one *ending* must not: by
   *  then the hold may have already handed the slot over, and re-arming it here would
   *  take the slot back for one `durationOut` — long enough to unmount the pending row
   *  and replay its entry animation. */
  useEffect(() => {
    setHoldExpired(false)
  }, [unseenKey, holdMs])

  useEffect(() => {
    if (!showUnseenBadge) return

    const timeout = setTimeout(
      () => setHoldExpired(true),
      holdMs + AMOUNT_BADGE_ANIMATION.durationOut,
    )

    return () => clearTimeout(timeout)
  }, [showUnseenBadge, unseenKey, holdMs])

  if ((showUnseenBadge || unseenHeld) && !holdExpired) return "unseen"
  return hasPendingAmount ? "pending" : "none"
}
