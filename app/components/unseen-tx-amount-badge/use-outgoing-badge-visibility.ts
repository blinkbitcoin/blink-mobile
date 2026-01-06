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

    const showTimeout = setTimeout(() => {
      setVisible(true)
    }, 50)

    const hideTimeout = setTimeout(() => {
      setVisible(false)
      onHide?.()
    }, ttlMs + 50)

    return () => {
      clearTimeout(showTimeout)
      clearTimeout(hideTimeout)
    }
  }, [txId, isOutgoing, amountText, ttlMs, onHide])

  return visible
}
