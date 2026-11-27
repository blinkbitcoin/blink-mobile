import { useCallback, useMemo } from "react"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useNavigation } from "@react-navigation/native"

import type { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useDisplayCurrency, usePriceConversion } from "@app/hooks"
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
  const { formatCurrency, formatMoneyAmount, hasCurrencyInfo, currencyListPending } =
    useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()
  const { feeReimbursementMemo } = useRemoteConfig()

  const baseTransactions = useAccountTransactions({ isSelfCustodial, transactions })

  /**
   * A self-custodial amount is priced on this device with this same converter, so
   * without one its transaction carries the raw wallet amount where the display
   * amount belongs. An announcement keeps the text it was made with, so making it
   * then would show that amount for the whole announcement. Waiting lets it go out
   * in the display currency once the price is in. A custodial amount was priced by
   * the server when it settled.
   */
  const isAwaitingPrice = isSelfCustodial && !convertMoneyAmount

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
    if (isAwaitingPrice) return null

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

    /**
     * The server's display amount is spelled with the currency list's symbol, and
     * without the list `formatCurrency` puts the bare code in its place ("+USD0.06").
     * The announcement keeps the text it was made with, so it waits while any source
     * could still add the code rather than show that for its whole run. A stored SDK
     * list is not enough: the backend carries codes the SDK lacks. Once every source has
     * answered without the code, it falls through to the wallet amount below.
     */
    const isDisplayCurrencyListed = hasDisplayAmount && hasCurrencyInfo(displayCurrency)
    if (hasDisplayAmount && !isDisplayCurrencyListed && currencyListPending) return null

    const formattedFromDisplay = isDisplayCurrencyListed
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
  }, [
    latestUnseenTx,
    isAwaitingPrice,
    formatCurrency,
    formatMoneyAmount,
    hasCurrencyInfo,
    currencyListPending,
  ])

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
