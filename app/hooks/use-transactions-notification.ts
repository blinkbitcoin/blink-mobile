import { useMemo } from "react"
import { useApolloClient, useQuery } from "@apollo/client"
import {
  TransactionFragment,
  TxLastSeenDocument,
  TxLastSeenQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { markTxLastSeenId } from "@app/graphql/client-only-query"

type TxDigest = {
  transactions?: ReadonlyArray<TransactionFragment>
  latestBtcTxId?: string | null
  latestUsdTxId?: string | null
}

type TxSource = ReadonlyArray<TransactionFragment> | TxDigest

const latestTxId = (
  transactions: ReadonlyArray<TransactionFragment>,
  currency: WalletCurrency,
) =>
  transactions
    .filter((tx) => tx.settlementCurrency === currency)
    .reduce(
      (acc, tx) =>
        tx.createdAt > acc.createdAt ? { createdAt: tx.createdAt, id: tx.id } : acc,
      { createdAt: 0, id: "" },
    ).id

const isTxDigest = (value: TxSource): value is TxDigest => !Array.isArray(value)

export const useTransactionsNotification = (txSource: TxSource) => {
  const client = useApolloClient()

  const latestTxIds = useMemo(() => {
    if (isTxDigest(txSource)) {
      return {
        btcId:
          txSource.latestBtcTxId ??
          latestTxId(txSource.transactions ?? [], WalletCurrency.Btc) ??
          "",
        usdId:
          txSource.latestUsdTxId ??
          latestTxId(txSource.transactions ?? [], WalletCurrency.Usd) ??
          "",
      }
    }
    return {
      btcId: latestTxId(txSource, WalletCurrency.Btc),
      usdId: latestTxId(txSource, WalletCurrency.Usd),
    }
  }, [txSource])

  const { data: lastSeenData } = useQuery<TxLastSeenQuery>(TxLastSeenDocument, {
    fetchPolicy: "cache-only",
    returnPartialData: true,
  })

  const seenBtc = lastSeenData?.txLastSeen?.btcId ?? ""
  const seenUsd = lastSeenData?.txLastSeen?.usdId ?? ""

  const latestBtcTxId = latestTxIds.btcId
  const latestUsdTxId = latestTxIds.usdId

  const hasUnseenBtcTx = useMemo(
    () => latestBtcTxId !== "" && latestBtcTxId !== seenBtc,
    [latestBtcTxId, seenBtc],
  )
  const hasUnseenUsdTx = useMemo(
    () => latestUsdTxId !== "" && latestUsdTxId !== seenUsd,
    [latestUsdTxId, seenUsd],
  )

  const markTxSeen = (currency: WalletCurrency) => {
    if (currency === WalletCurrency.Btc) {
      const id = latestBtcTxId
      if (id) {
        markTxLastSeenId(client, WalletCurrency.Btc, id)
      }
      return
    }
    if (currency === WalletCurrency.Usd) {
      const id = latestUsdTxId
      if (id) {
        markTxLastSeenId(client, WalletCurrency.Usd, id)
      }
    }
  }

  return { hasUnseenBtcTx, hasUnseenUsdTx, latestBtcTxId, latestUsdTxId, markTxSeen }
}
