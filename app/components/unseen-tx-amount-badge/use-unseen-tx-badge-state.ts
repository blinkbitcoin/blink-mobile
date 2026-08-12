import { useCallback, useMemo } from "react"

import { TransactionFragment, WalletCurrency } from "@app/graphql/generated"
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

  const { latestUnseenTx, unseenAmountText, navigateToTransaction, isOutgoing } =
    useUnseenTxAmountBadge({
      transactions,
      isSelfCustodial,
      hasUnseenBtcTx,
      hasUnseenUsdTx,
    })

  const { visible: showIncomingBadge, announcement: incomingAnnouncement } =
    useIncomingBadgeAutoSeen({
      isFocused,
      isOutgoing,
      tx: latestUnseenTx,
      amountText: unseenAmountText,
      markTxSeen,
    })

  /** An announced transaction is already marked seen, so the unseen state it was derived
   *  from has moved on while the badge is still on screen. Everything the screen renders
   *  therefore comes from the announcement while one is live, and falls back to the unseen
   *  state once it is released. */
  const isAnnouncingIncoming = incomingAnnouncement !== null
  const badgeAmountText = incomingAnnouncement?.amountText ?? unseenAmountText
  const badgeTxId = incomingAnnouncement?.txId ?? latestUnseenTx?.id
  const isOutgoingBadge = isAnnouncingIncoming ? false : isOutgoing

  /** The outgoing badge must not run its cycle behind an incoming one: it would never be
   *  painted and would still mark its transaction seen when it hid. Suppressing its inputs
   *  parks it until the incoming announcement is released and it can show for real. */
  const outgoingTxId = isAnnouncingIncoming ? undefined : latestUnseenTx?.id
  const outgoingAmountText = isAnnouncingIncoming ? null : unseenAmountText

  const handleOutgoingBadgeHide = useCallback(() => {
    if (latestUnseenTx?.settlementCurrency) {
      markTxSeen(latestUnseenTx.settlementCurrency)
    }
  }, [latestUnseenTx?.settlementCurrency, markTxSeen])

  const showOutgoingBadge = useOutgoingBadgeVisibility({
    txId: outgoingTxId,
    amountText: outgoingAmountText,
    isOutgoing: isOutgoingBadge,
    onHide: handleOutgoingBadgeHide,
  })

  /** The wallet rows read these to light their unseen dot, so an announced currency has to
   *  keep reading unseen for as long as its badge is up: the seen state itself flipped in
   *  the same commit the badge appeared. */
  const isAnnouncingBtc = incomingAnnouncement?.currency === WalletCurrency.Btc
  const isAnnouncingUsd = incomingAnnouncement?.currency === WalletCurrency.Usd

  const handleUnseenBadgePress = useCallback(() => {
    if (!badgeTxId) return

    navigateToTransaction(badgeTxId)
  }, [navigateToTransaction, badgeTxId])

  return {
    hasUnseenBtcTx: hasUnseenBtcTx || isAnnouncingBtc,
    hasUnseenUsdTx: hasUnseenUsdTx || isAnnouncingUsd,
    unseenAmountText: badgeAmountText,
    handleUnseenBadgePress,
    showIncomingBadge,
    showOutgoingBadge,
    isOutgoing: isOutgoingBadge,
    latestUnseenTxId: badgeTxId,
    transactionCount: transactions.length,
  }
}
