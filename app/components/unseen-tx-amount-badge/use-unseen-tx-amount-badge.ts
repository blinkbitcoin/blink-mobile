import { useCallback, useMemo } from "react"
import { StackNavigationProp } from "@react-navigation/stack"
import { useNavigation } from "@react-navigation/native"

import { TransactionFragment, TxDirection, WalletCurrency } from "@app/graphql/generated"
import type { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useDisplayCurrency } from "@app/hooks"
import { toWalletAmount } from "@app/types/amounts"

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

  const latestUnseenTx = useMemo(() => {
    if (!transactions || transactions.length === 0) return
    if (!hasUnseenBtcTx && !hasUnseenUsdTx) return

    const unseenCurrencies: WalletCurrency[] = []
    if (hasUnseenBtcTx) unseenCurrencies.push(WalletCurrency.Btc)
    if (hasUnseenUsdTx) unseenCurrencies.push(WalletCurrency.Usd)

    const unseenTransactions = transactions.filter((tx) => {
      if (!unseenCurrencies.includes(tx.settlementCurrency)) return false
      if (tx.memo?.toLowerCase() === feeReimbursementMemo.toLowerCase()) return false

      return true
    })

    if (unseenTransactions.length === 0) return

    return unseenTransactions.reduce((latest, tx) =>
      tx.createdAt > latest.createdAt ? tx : latest,
    )
  }, [transactions, hasUnseenBtcTx, hasUnseenUsdTx, feeReimbursementMemo])

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
