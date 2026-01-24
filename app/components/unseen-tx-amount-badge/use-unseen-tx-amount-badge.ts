import { useCallback, useMemo } from "react"
import { StackNavigationProp } from "@react-navigation/stack"
import { useNavigation } from "@react-navigation/native"
import { useApolloClient } from "@apollo/client"

import type { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useDisplayCurrency } from "@app/hooks"
import { toWalletAmount } from "@app/types/amounts"
import {
  TransactionFragment,
  TxDirection,
  WalletCurrency,
  HomeAuthedDocument,
  HomeAuthedQuery,
  TxStatus,
} from "@app/graphql/generated"

type UnseenTxAmountBadgeParams = {
  transactions?: TransactionFragment[] | null
  hasUnseenUsdTx: boolean
  hasUnseenBtcTx: boolean
}

export const useUnseenTxAmountBadge = ({
  transactions,
  hasUnseenUsdTx,
  hasUnseenBtcTx,
}: UnseenTxAmountBadgeParams) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { formatCurrency, formatMoneyAmount } = useDisplayCurrency()
  const { feeReimbursementMemo } = useRemoteConfig()
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

  const latestUnseenTx = useMemo(() => {
    const baseTransactions =
      transactions && transactions.length > 0 ? transactions : readCachedTransactions()

    if (!baseTransactions || baseTransactions.length === 0) return
    if (!hasUnseenBtcTx && !hasUnseenUsdTx) return

    const unseenCurrencies: WalletCurrency[] = []
    if (hasUnseenBtcTx) unseenCurrencies.push(WalletCurrency.Btc)
    if (hasUnseenUsdTx) unseenCurrencies.push(WalletCurrency.Usd)

    const unseenTransactions = baseTransactions.filter((tx) => {
      if (!unseenCurrencies.includes(tx.settlementCurrency)) return false
      if (tx.settlementAmount === 0) return false
      if (tx.memo?.toLowerCase() === feeReimbursementMemo.toLowerCase()) return false

      return true
    })

    if (unseenTransactions.length === 0) return

    return unseenTransactions.reduce((latest, tx) =>
      tx.createdAt > latest.createdAt ? tx : latest,
    )
  }, [
    transactions,
    hasUnseenBtcTx,
    hasUnseenUsdTx,
    feeReimbursementMemo,
    readCachedTransactions,
  ])

  const unseenAmountText = useMemo(() => {
    if (!latestUnseenTx) return null

    const {
      settlementDisplayAmount: displayAmount,
      settlementDisplayCurrency: displayCurrency,
      settlementAmount: rawAmount,
      settlementCurrency: rawCurrency,
      direction,
    } = latestUnseenTx

    const hasDisplayAmount =
      displayAmount !== null && displayAmount !== undefined && Boolean(displayCurrency)
    const hasRawAmount =
      rawAmount !== null && rawAmount !== undefined && Boolean(rawCurrency)

    const formattedFromDisplay = hasDisplayAmount
      ? formatCurrency({ amountInMajorUnits: displayAmount, currency: displayCurrency })
      : null

    const formattedFromRaw =
      !formattedFromDisplay && hasRawAmount
        ? formatMoneyAmount({
            moneyAmount: toWalletAmount({
              amount: rawAmount,
              currency: rawCurrency,
            }),
          })
        : null

    const formatted = formattedFromDisplay ?? formattedFromRaw
    if (!formatted) return null

    return direction === TxDirection.Receive ? `+${formatted}` : formatted
  }, [latestUnseenTx, formatCurrency, formatMoneyAmount])

  const handleUnseenBadgePress = useCallback(() => {
    if (!latestUnseenTx?.id) return

    navigation.navigate("transactionDetail", { txid: latestUnseenTx.id })
  }, [navigation, latestUnseenTx?.id])

  return {
    latestUnseenTx,
    unseenAmountText,
    handleUnseenBadgePress,
    isOutgoing: latestUnseenTx?.direction === TxDirection.Send,
  }
}
