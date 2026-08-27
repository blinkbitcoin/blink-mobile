import { useCallback, useMemo } from "react"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useNavigation } from "@react-navigation/native"

import type { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useDisplayCurrency } from "@app/hooks"
import {
  isAnnounceableTransaction,
  useAccountTransactions,
} from "@app/hooks/use-account-transactions"
import { toWalletAmount } from "@app/types/amounts"
import { TransactionFragment, TxDirection, WalletCurrency } from "@app/graphql/generated"

type UnseenTxAmountBadgeParams = {
  transactions?: readonly TransactionFragment[] | null
  isSelfCustodial?: boolean
  hasUnseenUsdTx: boolean
  hasUnseenBtcTx: boolean
}

export const useUnseenTxAmountBadge = ({
  transactions,
  isSelfCustodial = false,
  hasUnseenUsdTx,
  hasUnseenBtcTx,
}: UnseenTxAmountBadgeParams) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { formatCurrency, formatMoneyAmount } = useDisplayCurrency()
  const { feeReimbursementMemo } = useRemoteConfig()

  const baseTransactions = useAccountTransactions({ isSelfCustodial, transactions })

  const latestUnseenTx = useMemo(() => {
    if (baseTransactions.length === 0) return
    if (!hasUnseenBtcTx && !hasUnseenUsdTx) return

    const unseenCurrencies: WalletCurrency[] = []
    if (hasUnseenBtcTx) unseenCurrencies.push(WalletCurrency.Btc)
    if (hasUnseenUsdTx) unseenCurrencies.push(WalletCurrency.Usd)

    const unseenTransactions = baseTransactions.filter(
      (tx) =>
        unseenCurrencies.includes(tx.settlementCurrency) &&
        isAnnounceableTransaction(tx, feeReimbursementMemo),
    )

    if (unseenTransactions.length === 0) return

    return unseenTransactions.reduce((latest, tx) =>
      tx.createdAt > latest.createdAt ? tx : latest,
    )
  }, [baseTransactions, hasUnseenBtcTx, hasUnseenUsdTx, feeReimbursementMemo])

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

  /** Takes the transaction to open rather than reading the newest unseen one: once a badge
   *  is announced its transaction is already marked seen, so by the time it can be pressed
   *  there is no unseen transaction left to derive the target from. */
  const navigateToTransaction = useCallback(
    (txid: string) => {
      if (!txid) return

      navigation.navigate("transactionDetail", { txid })
    },
    [navigation],
  )

  return {
    latestUnseenTx,
    unseenAmountText,
    navigateToTransaction,
    isOutgoing: latestUnseenTx?.direction === TxDirection.Send,
  }
}
