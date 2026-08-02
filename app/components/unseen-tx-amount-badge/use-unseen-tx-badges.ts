import { useCallback } from "react"

import { useTransactionSeenState } from "@app/hooks"
import { TransactionFragment } from "@app/graphql/generated"

import { useUnseenTxAmountBadge } from "./use-unseen-tx-amount-badge"
import { useOutgoingBadgeVisibility } from "./use-outgoing-badge-visibility"
import { useIncomingBadgeAutoSeen } from "./use-incoming-badge-auto-seen"

type UseUnseenTxBadgesParams = {
  accountId: string
  transactions?: TransactionFragment[] | null
  isFocused: boolean
}

/**
 * Composes the four badge hooks into the single value the home screen renders
 * from. They are only ever used together — the seen-state feeds the badge
 * contents, which in turn drive both visibility hooks — so keeping the wiring
 * (and the outgoing-badge hide callback, which never escapes) in one place.
 */
export const useUnseenTxBadges = ({
  accountId,
  transactions,
  isFocused,
}: UseUnseenTxBadgesParams) => {
  const { hasUnseenBtcTx, hasUnseenUsdTx, markTxSeen } = useTransactionSeenState(
    accountId,
    transactions ?? undefined,
  )

  const { latestUnseenTx, unseenAmountText, handleUnseenBadgePress, isOutgoing } =
    useUnseenTxAmountBadge({
      transactions,
      hasUnseenBtcTx,
      hasUnseenUsdTx,
    })

  const handleOutgoingBadgeHide = useCallback(() => {
    if (latestUnseenTx?.settlementCurrency) {
      markTxSeen(latestUnseenTx.settlementCurrency)
    }
  }, [latestUnseenTx?.settlementCurrency, markTxSeen])

  const showOutgoingBadge = useOutgoingBadgeVisibility({
    txId: latestUnseenTx?.id,
    amountText: unseenAmountText,
    isOutgoing,
    onHide: handleOutgoingBadgeHide,
  })

  const showIncomingBadge = useIncomingBadgeAutoSeen({
    isFocused,
    isOutgoing,
    unseenCurrency: latestUnseenTx?.settlementCurrency,
    markTxSeen,
  })

  return {
    hasUnseenBtcTx,
    hasUnseenUsdTx,
    latestUnseenTx,
    unseenAmountText,
    handleUnseenBadgePress,
    isOutgoing,
    showOutgoingBadge,
    showIncomingBadge,
  }
}
