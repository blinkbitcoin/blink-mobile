import { useCallback, useMemo } from "react"
import { StackNavigationProp } from "@react-navigation/stack"
import { useNavigation } from "@react-navigation/native"

import { TransactionFragment, TxDirection, WalletCurrency } from "@app/graphql/generated"
import type { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useDisplayCurrency } from "@app/hooks"
import { toWalletAmount } from "@app/types/amounts"

type IncomingBadgeParams = {
  transactions?: TransactionFragment[] | null
  hasUnseenUsdTx: boolean
  hasUnseenBtcTx: boolean
}

export const useIncomingAmountBadge = ({
  transactions,
  hasUnseenUsdTx,
  hasUnseenBtcTx,
}: IncomingBadgeParams) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { formatCurrency, formatMoneyAmount } = useDisplayCurrency()

  const latestIncomingTx = useMemo(() => {
    if (!transactions) return

    const wantedCurrency = hasUnseenUsdTx
      ? WalletCurrency.Usd
      : hasUnseenBtcTx
        ? WalletCurrency.Btc
        : null
    if (!wantedCurrency) return

    return transactions.find(
      (t) =>
        t.direction === TxDirection.Receive && t.settlementCurrency === wantedCurrency,
    )
  }, [transactions, hasUnseenUsdTx, hasUnseenBtcTx])

  const incomingAmountText = useMemo(() => {
    if (!latestIncomingTx) return null

    const {
      settlementDisplayAmount: displayAmount,
      settlementDisplayCurrency: displayCurrency,
      settlementAmount: rawAmount,
      settlementCurrency: rawCurrency,
      direction,
    } = latestIncomingTx

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
              currency: rawCurrency as WalletCurrency,
            }),
          })
        : null

    const formatted = formattedFromDisplay ?? formattedFromRaw
    if (!formatted) return null

    const sign = direction === TxDirection.Receive ? "+" : "-"
    return `${sign}${formatted}`
  }, [latestIncomingTx, formatCurrency, formatMoneyAmount])

  const handleIncomingBadgePress = useCallback(() => {
    if (!latestIncomingTx?.id) return

    navigation.navigate("transactionDetail", { txid: latestIncomingTx.id })
  }, [navigation, latestIncomingTx?.id])

  return {
    latestIncomingTx,
    incomingAmountText,
    handleIncomingBadgePress,
  }
}
