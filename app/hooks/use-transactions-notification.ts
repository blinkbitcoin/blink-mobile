import { useMemo, useCallback } from "react"
import { useApolloClient, useQuery } from "@apollo/client"

import { markTxLastSeenId } from "@app/graphql/client-only-query"
import {
  TransactionFragment,
  TxLastSeenDocument,
  TxLastSeenQuery,
  WalletCurrency,
  HomeAuthedDocument,
  HomeAuthedQuery,
  TxStatus,
  TxDirection,
} from "@app/graphql/generated"

type TransactionDigest = {
  transactions?: ReadonlyArray<TransactionFragment>
  latestBtcTxId?: string | null
  latestUsdTxId?: string | null
}

type TransactionSource = ReadonlyArray<TransactionFragment> | TransactionDigest

const getLatestTransactionId = (
  transactions: ReadonlyArray<TransactionFragment>,
  currency: WalletCurrency,
): string => {
  const filteredTransactions = transactions.filter(
    (transaction) => transaction.settlementCurrency === currency,
  )
  if (filteredTransactions.length === 0) return ""

  const latestTransaction = filteredTransactions.reduce((latest, transaction) =>
    transaction.createdAt > latest.createdAt ? transaction : latest,
  )
  return latestTransaction.id
}

const isTransactionDigest = (value: TransactionSource): value is TransactionDigest =>
  !Array.isArray(value)

export const useTransactionsNotification = (transactionSource: TransactionSource) => {
  const client = useApolloClient()

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
    const baseTransactions = isTransactionDigest(transactionSource)
      ? transactionSource.transactions && transactionSource.transactions.length > 0
        ? transactionSource.transactions
        : readCachedTransactions()
      : transactionSource.length > 0
        ? transactionSource
        : readCachedTransactions()

    if (isTransactionDigest(transactionSource)) {
      return {
        btcId:
          transactionSource.latestBtcTxId ||
          getLatestTransactionId(baseTransactions, WalletCurrency.Btc),
        usdId:
          transactionSource.latestUsdTxId ||
          getLatestTransactionId(baseTransactions, WalletCurrency.Usd),
      }
    }
    return {
      btcId: getLatestTransactionId(baseTransactions, WalletCurrency.Btc),
      usdId: getLatestTransactionId(baseTransactions, WalletCurrency.Usd),
    }
  }, [readCachedTransactions, transactionSource])

  const { data: lastSeenData } = useQuery<TxLastSeenQuery>(TxLastSeenDocument, {
    fetchPolicy: "cache-only",
    returnPartialData: true,
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
        markTxLastSeenId(client, currency, transactionIdToMark)
      }
    },
    [client, latestBtcTxId, latestUsdTxId],
  )

  return {
    hasUnseenBtcTx,
    hasUnseenUsdTx,
    latestBtcTxId,
    latestUsdTxId,
    markTxSeen: markTransactionAsSeen,
  }
}
