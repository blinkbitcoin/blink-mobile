import { useCallback, useMemo } from "react"

import { TransactionFragment } from "@app/graphql/generated"
import { toCustodialTransactions } from "@app/hooks/use-account-transactions"
import { useTransactionSeenState } from "@app/hooks/use-transaction-seen-state"
import { useSelfCustodialTransactionFragments } from "@app/self-custodial/hooks/use-self-custodial-transaction-fragments"
import { NormalizedTransaction, NO_TRANSACTIONS } from "@app/types/transaction"

import { useIncomingBadgeAutoSeen } from "./use-incoming-badge-auto-seen"
import { useOutgoingBadgeVisibility } from "./use-outgoing-badge-visibility"
import { useUnseenTxAmountBadge } from "./use-unseen-tx-amount-badge"

type UnseenTxBadgeStateParams = {
  isSelfCustodial: boolean
  isFocused: boolean
  custodialAccountId?: string
  selfCustodialTransactions: readonly NormalizedTransaction[]
  pendingIncomingTransactions?: readonly TransactionFragment[] | null
  transactionEdges?: readonly { readonly node: TransactionFragment }[] | null
}

/**
 * Everything the home screen needs to show the unseen-transaction badge, for either kind
 * of account. Custodial data arrives from the home query while a self-custodial account
 * has no `me` to answer it, so its transactions come from the wallet and are mapped to
 * the shared fragment shape here. Mapping also primes the Apollo cache, which is what
 * lets the transaction detail behind the badge load.
 *
 * `custodialAccountId` only keys the custodial seen state; `useTransactionSeenState`
 * resolves the self-custodial key from the active account itself, so this hook and the
 * history and detail screens all agree on it.
 */
export const useUnseenTxBadgeState = ({
  isSelfCustodial,
  isFocused,
  custodialAccountId,
  selfCustodialTransactions,
  pendingIncomingTransactions,
  transactionEdges,
}: UnseenTxBadgeStateParams) => {
  const selfCustodialSource = isSelfCustodial
    ? selfCustodialTransactions
    : NO_TRANSACTIONS

  const selfCustodialFragments = useSelfCustodialTransactionFragments(selfCustodialSource)

  const custodialFragments = useMemo(
    () => toCustodialTransactions(pendingIncomingTransactions, transactionEdges),
    [pendingIncomingTransactions, transactionEdges],
  )

  const transactions = isSelfCustodial ? selfCustodialFragments : custodialFragments

  const { hasUnseenBtcTx, hasUnseenUsdTx, markTxSeen } = useTransactionSeenState({
    accountId: custodialAccountId || "",
    isSelfCustodial,
    transactions,
  })

  const { latestUnseenTx, unseenAmountText, handleUnseenBadgePress, isOutgoing } =
    useUnseenTxAmountBadge({
      transactions,
      isSelfCustodial,
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
    unseenAmountText,
    handleUnseenBadgePress,
    showIncomingBadge,
    showOutgoingBadge,
    isOutgoing,
    latestUnseenTxId: latestUnseenTx?.id,
    transactionCount: transactions.length,
  }
}
