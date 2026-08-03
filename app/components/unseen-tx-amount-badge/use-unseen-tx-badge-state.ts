import { useCallback, useMemo } from "react"

import { TransactionFragment, TxDirection, TxStatus } from "@app/graphql/generated"
import { useTransactionSeenState } from "@app/hooks/use-transaction-seen-state"
import { useSelfCustodialTransactionFragments } from "@app/self-custodial/hooks/use-self-custodial-transaction-fragments"
import { NormalizedTransaction } from "@app/types/transaction"

import { useIncomingBadgeAutoSeen } from "./use-incoming-badge-auto-seen"
import { useOutgoingBadgeVisibility } from "./use-outgoing-badge-visibility"
import { useUnseenTxAmountBadge } from "./use-unseen-tx-amount-badge"

/** Stable identity so the fragment hook does not re-run on every custodial render. */
const EMPTY_SELF_CUSTODIAL_TRANSACTIONS: NormalizedTransaction[] = []

type UnseenTxBadgeStateParams = {
  isSelfCustodial: boolean
  isFocused: boolean
  custodialAccountId?: string
  selfCustodialAccountId?: string
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
 * The seen state is stored per account id, so the active account keys it in self-custodial
 * mode instead of the custodial account the home query would return.
 */
export const useUnseenTxBadgeState = ({
  isSelfCustodial,
  isFocused,
  custodialAccountId,
  selfCustodialAccountId,
  selfCustodialTransactions,
  pendingIncomingTransactions,
  transactionEdges,
}: UnseenTxBadgeStateParams) => {
  const selfCustodialSource = useMemo(
    () =>
      isSelfCustodial ? selfCustodialTransactions : EMPTY_SELF_CUSTODIAL_TRANSACTIONS,
    [isSelfCustodial, selfCustodialTransactions],
  )

  const selfCustodialFragments = useSelfCustodialTransactionFragments(selfCustodialSource)

  const custodialFragments = useMemo(() => {
    const txs: TransactionFragment[] = []
    if (pendingIncomingTransactions) txs.push(...pendingIncomingTransactions)

    const settled =
      transactionEdges
        ?.map((edge) => edge.node)
        .filter(
          (tx) => tx.status !== TxStatus.Pending || tx.direction === TxDirection.Send,
        ) ?? []
    txs.push(...settled)

    return txs
  }, [pendingIncomingTransactions, transactionEdges])

  const transactions = isSelfCustodial ? selfCustodialFragments : custodialFragments
  const seenStateAccountId = isSelfCustodial ? selfCustodialAccountId : custodialAccountId

  const { hasUnseenBtcTx, hasUnseenUsdTx, markTxSeen } = useTransactionSeenState(
    seenStateAccountId || "",
    transactions,
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
    unseenAmountText,
    handleUnseenBadgePress,
    showIncomingBadge,
    showOutgoingBadge,
    isOutgoing,
    latestUnseenTxId: latestUnseenTx?.id,
    transactionCount: transactions.length,
  }
}
