import { useEffect, useRef, useState } from "react"

import { AMOUNT_BADGE_ANIMATION } from "@app/components/amount-badge"
import { TransactionFragment, WalletCurrency } from "@app/graphql/generated"

/** Shared with the badge itself and with the slot arbitration, so the three
 *  cannot drift apart and cut each other's animations short. */
const EXIT_ANIMATION_MS = AMOUNT_BADGE_ANIMATION.durationOut

export type IncomingBadgeAnnouncement = {
  txId: string
  currency: WalletCurrency
  amountText: string
}

type IncomingBadgeAutoSeenParams = {
  isFocused: boolean
  isOutgoing: boolean | undefined
  tx?: TransactionFragment
  amountText: string | null
  delayMs?: number
  markTxSeen: (currency: WalletCurrency) => void
}

/**
 * Announces an incoming transaction on the home badge exactly once, marking it seen the
 * moment it reaches the screen. Deferring that mark to the end of the display window
 * loses it whenever the app closes first, which is what made the same transaction get
 * announced again on the next launch.
 *
 * Marking seen immediately empties the unseen state the badge is derived from, so the
 * announcement is held here until the exit animation has played: the caller renders what
 * this hook latched rather than what is still unseen.
 */
export const useIncomingBadgeAutoSeen = ({
  isFocused,
  isOutgoing,
  tx,
  amountText,
  delayMs = 5000,
  markTxSeen,
}: IncomingBadgeAutoSeenParams) => {
  const [announcement, setAnnouncement] = useState<IncomingBadgeAnnouncement | null>(null)
  const [visible, setVisible] = useState(false)
  /** Keyed by transaction rather than by currency so a second receive in the same wallet
   *  is still announced, while the one already shown never comes back. */
  const announcedTxIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const isIncoming = isOutgoing === false
    if (!isIncoming) return
    if (!isFocused) return
    if (!tx || !amountText) return
    if (announcedTxIdRef.current === tx.id) return
    /** Marking seen promotes the next unseen transaction immediately, so without this the
     *  one already on screen would be overwritten a frame later and never be read. Each
     *  waits its turn instead. */
    if (announcement) return

    announcedTxIdRef.current = tx.id
    setAnnouncement({
      txId: tx.id,
      currency: tx.settlementCurrency,
      amountText,
    })
    setVisible(true)
    markTxSeen(tx.settlementCurrency)
  }, [isFocused, isOutgoing, tx, amountText, markTxSeen, announcement])

  useEffect(() => {
    if (!announcement) return

    const hideTimeout = setTimeout(() => setVisible(false), delayMs)
    return () => clearTimeout(hideTimeout)
  }, [announcement, delayMs])

  useEffect(() => {
    const isPlayingExitAnimation = Boolean(announcement) && !visible
    if (!isPlayingExitAnimation) return

    const releaseTimeout = setTimeout(() => setAnnouncement(null), EXIT_ANIMATION_MS)
    return () => clearTimeout(releaseTimeout)
  }, [announcement, visible])

  return { visible, announcement }
}
