import * as React from "react"

import { AmountBadge } from "@app/components/amount-badge"

type Props = {
  amountText: string
  visible?: boolean
  onPress?: () => void
  accessibilityLabel?: string
}

/**
 * The unconfirmed-deposit amount under the home balance. Unlike the unseen-tx
 * badge it is state-driven: it stays until the deposit confirms (blink-wip#937),
 * and the chain icon marks it as an onchain arrival rather than a settled
 * transaction.
 */
export const PendingAmountBadge: React.FC<Props> = ({
  amountText,
  visible = true,
  onPress,
  accessibilityLabel,
}) => (
  <AmountBadge
    amountText={amountText}
    variant="pending"
    iconName="chain"
    visible={visible}
    onPress={onPress}
    accessibilityLabel={accessibilityLabel}
    testID="pending-receive-badge"
  />
)
