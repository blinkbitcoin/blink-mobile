import * as React from "react"

import { AmountBadge } from "@app/components/amount-badge"

type UnseenTxAmountBadgeProps = {
  amountText: string
  visible?: boolean
  onPress?: () => void
  isOutgoing?: boolean
}

/**
 * The amount of the latest transaction the user has not acknowledged yet.
 * Transient: the screen's visibility hooks auto-dismiss it after a few seconds,
 * which is the whole difference from the pending-deposit row it shares the slot
 * with.
 */
export const UnseenTxAmountBadge: React.FC<UnseenTxAmountBadgeProps> = ({
  amountText,
  visible = true,
  onPress,
  isOutgoing,
}) => {
  const variant = isOutgoing ? "outgoing" : "incoming"

  return (
    <AmountBadge
      amountText={amountText}
      variant={variant}
      visible={visible}
      onPress={onPress}
    />
  )
}
