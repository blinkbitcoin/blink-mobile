import { useMemo, useCallback } from "react"
import { useApolloClient } from "@apollo/client"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { markTxLastSeenId } from "@app/graphql/client-only-query"
import {
  TransactionFragment,
  useTxLastSeenQuery,
  WalletCurrency,
  HomeAuthedDocument,
  HomeAuthedQuery,
  TxStatus,
  TxDirection,
} from "@app/graphql/generated"

const getLatestTransactionId = (
  transactions: ReadonlyArray<TransactionFragment>,
  currency: WalletCurrency,
  feeReimbursementMemo: string,
): string => {
  const filteredTransactions = transactions.filter(
    (transaction) =>
      transaction.settlementCurrency === currency &&
      transaction.settlementAmount !== 0 &&
      transaction.memo?.toLowerCase() !== feeReimbursementMemo.toLowerCase(),
  )
  if (filteredTransactions.length === 0) return ""

  const latestTransaction = filteredTransactions.reduce((latest, transaction) =>
    transaction.createdAt > latest.createdAt ? transaction : latest,
  )
  return latestTransaction.id
}

export const useTransactionSeenState = (
  accountId: string,
  transactions?: ReadonlyArray<TransactionFragment>,
) => {
  const client = useApolloClient()
  const { feeReimbursementMemo } = useRemoteConfig()

  const readCachedTransactions = useCallback((): ReadonlyArray<TransactionFragment> => {
    const data = client.readQuery<HomeAuthedQuery>({ query: HomeAuthedDocument })
    const pendingTransactions =
      data?.me?.defaultAccount?.pendingIncomingTransactions || []
    const transactionEdges = data?.me?.defaultAccount?.transactions?.edges
    if (!transactionEdges?.length) return pendingTransactions

    const settledTransactions = transactionEdges
      .map((edge) => edge.node)
      .filter(
        (transaction) =>
          transaction.status !== TxStatus.Pending ||
          transaction.direction === TxDirection.Send,
      )
    if (pendingTransactions.length === 0) return settledTransactions
    return [...pendingTransactions, ...settledTransactions]
  }, [client])

  const latestTransactionIds = useMemo(() => {
    const baseTransactions =
      transactions && transactions.length > 0 ? transactions : readCachedTransactions()

    return {
      btcId: getLatestTransactionId(
        baseTransactions,
        WalletCurrency.Btc,
        feeReimbursementMemo,
      ),
      usdId: getLatestTransactionId(
        baseTransactions,
        WalletCurrency.Usd,
        feeReimbursementMemo,
      ),
    }
  }, [readCachedTransactions, transactions, feeReimbursementMemo])

  const { data: lastSeenData } = useTxLastSeenQuery({
    fetchPolicy: "cache-only",
    returnPartialData: true,
    variables: { accountId },
  })

  const lastSeenBtcId = lastSeenData?.txLastSeen?.btcId || ""
  const lastSeenUsdId = lastSeenData?.txLastSeen?.usdId || ""
  const latestBtcTxId = latestTransactionIds.btcId
  const latestUsdTxId = latestTransactionIds.usdId

  const hasUnseenBtcTx = useMemo(
    () => latestBtcTxId !== "" && latestBtcTxId !== lastSeenBtcId,
    [latestBtcTxId, lastSeenBtcId],
  )

  const hasUnseenUsdTx = useMemo(
    () => latestUsdTxId !== "" && latestUsdTxId !== lastSeenUsdId,
    [latestUsdTxId, lastSeenUsdId],
  )

  const markTransactionAsSeen = useCallback(
    (currency: WalletCurrency) => {
      const transactionIdToMark =
        currency === WalletCurrency.Btc ? latestBtcTxId : latestUsdTxId
      if (transactionIdToMark) {
        markTxLastSeenId({ client, accountId, currency, id: transactionIdToMark })
      }
    },
    [client, latestBtcTxId, latestUsdTxId, accountId],
  )

  return {
    hasUnseenBtcTx,
    hasUnseenUsdTx,
    latestBtcTxId,
    latestUsdTxId,
    lastSeenBtcId,
    lastSeenUsdId,
    markTxSeen: markTransactionAsSeen,
  }
}
