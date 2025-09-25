import { useEffect, useMemo, useState } from "react"
import { useApolloClient } from "@apollo/client"
import {
  TransactionFragment,
  TxLastSeenDocument,
  TxLastSeenQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { markTxLastSeenId } from "@app/graphql/client-only-query"

type TxHints = {
  transactions?: ReadonlyArray<TransactionFragment>
  latestBtcId?: string | null
  latestUsdId?: string | null
}

type TxSource = ReadonlyArray<TransactionFragment> | TxHints

const latestId = (
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

const isHints = (value: TxSource): value is TxHints => !Array.isArray(value)

export const useUnseenTransactions = (txSource: TxSource) => {
  const client = useApolloClient()
  const [btc, setBtc] = useState(false)
  const [usd, setUsd] = useState(false)

  const ids = useMemo(() => {
    if (isHints(txSource)) {
      return {
        btcId:
          txSource.latestBtcId ??
          latestId(txSource.transactions ?? [], WalletCurrency.Btc) ??
          "",
        usdId:
          txSource.latestUsdId ??
          latestId(txSource.transactions ?? [], WalletCurrency.Usd) ??
          "",
      }
    }
    return {
      btcId: latestId(txSource, WalletCurrency.Btc),
      usdId: latestId(txSource, WalletCurrency.Usd),
    }
  }, [txSource])

  useEffect(() => {
    try {
      const data = client.readQuery<TxLastSeenQuery>({ query: TxLastSeenDocument })
      setBtc(ids.btcId !== "" && ids.btcId !== (data?.txLastSeen?.btcId ?? ""))
      setUsd(ids.usdId !== "" && ids.usdId !== (data?.txLastSeen?.usdId ?? ""))
    } catch {
      setBtc(false)
      setUsd(false)
    }
  }, [client, ids])

  const markSeen = (currency: WalletCurrency) => {
    if (currency === WalletCurrency.Btc && ids.btcId) {
      markTxLastSeenId(client, WalletCurrency.Btc, ids.btcId)
      setBtc(false)
      return
    }
    if (currency === WalletCurrency.Usd && ids.usdId) {
      markTxLastSeenId(client, WalletCurrency.Usd, ids.usdId)
      setUsd(false)
    }
  }

  return { showBtc: btc, showUsd: usd, markSeen }
}
