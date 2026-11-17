import { useEffect, useState } from "react"

export const useOutgoingBadgeVisibility = ({
  txId,
  isOutgoing,
  amountText,
  ttlMs = 5000,
  onHide,
}: {
  txId?: string
  isOutgoing?: boolean
  amountText: string | null
  ttlMs?: number
  onHide?: () => void
}) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isOutgoing || !amountText) {
      setVisible(false)
      return
    }

    let hideTimeout: ReturnType<typeof setTimeout> | undefined
    let isAwaitingHide = false

    const showTimeout = setTimeout(() => {
      setVisible(true)
      isAwaitingHide = true
      hideTimeout = setTimeout(() => {
        isAwaitingHide = false
        setVisible(false)
        onHide?.()
      }, ttlMs)
    }, 50)

    return () => {
      clearTimeout(showTimeout)
      if (hideTimeout !== undefined) {
        clearTimeout(hideTimeout)
      }
      /**
       * A badge cut short while it was on screen still announced its transaction, so it
       * owes the same mark-seen its own timer would have done; without this, a send
       * superseded by a newer one stays unseen for good. The flag is what keeps that from
       * over-reaching: it is false before the badge paints, which is how a badge parked
       * behind an incoming announcement avoids marking a transaction nobody saw, and false
       * again after the timer fires, so a hide already paid for is never paid twice.
       */
      if (isAwaitingHide) {
        onHide?.()
      }
    }
  }, [txId, isOutgoing, amountText, ttlMs, onHide])

  return visible
}
