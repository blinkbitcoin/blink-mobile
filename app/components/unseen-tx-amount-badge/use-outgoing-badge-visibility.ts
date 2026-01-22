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

    const showTimeout = setTimeout(() => {
      setVisible(true)
      hideTimeout = setTimeout(() => {
        setVisible(false)
        onHide?.()
      }, ttlMs)
    }, 50)

    return () => {
      clearTimeout(showTimeout)
      if (hideTimeout !== undefined) {
        clearTimeout(hideTimeout)
      }
    }
  }, [txId, isOutgoing, amountText, ttlMs, onHide])

  return visible
}
