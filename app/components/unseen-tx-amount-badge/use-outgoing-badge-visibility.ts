import { useEffect, useState } from "react"

export const useOutgoingBadgeVisibility = ({
  txId,
  isOutgoing,
  amountText,
  ttlMs = 5000,
}: {
  txId?: string
  isOutgoing?: boolean
  amountText: string | null
  ttlMs?: number
}) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isOutgoing || !amountText) {
      setVisible(false)
      return
    }

    setVisible(true)

    const id = setTimeout(() => {
      setVisible(false)
    }, ttlMs)

    return () => clearTimeout(id)
  }, [txId, isOutgoing, amountText, ttlMs])

  return visible
}
