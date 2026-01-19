import React, { FunctionComponent } from "react"
import { View } from "react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { WalletAmount } from "@app/types/amounts"
import { Text, makeStyles } from "@rn-vui/themed"

import { CurrencyPill } from "../atomic/currency-pill"

type WalletSummaryProps = {
  settlementAmount: WalletAmount<WalletCurrency>
  txDisplayAmount: string | number
  txDisplayCurrency: string
  amountType: "RECEIVE" | "SEND"
}

const amountTypeToSymbol = {
  RECEIVE: "+",
  SEND: "-",
} as const

// TODO: this code should be refactored
// it's just used in transaction details
export const WalletSummary: FunctionComponent<WalletSummaryProps> = ({
  settlementAmount,
  txDisplayAmount,
  txDisplayCurrency,
  amountType,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const { formatMoneyAmount, formatCurrency } = useDisplayCurrency()
  const walletName =
    settlementAmount.currency === WalletCurrency.Btc
      ? LL.common.btcAccount()
      : LL.common.usdAccount()

  const formattedDisplayAmount = formatCurrency({
    amountInMajorUnits: txDisplayAmount,
    currency: txDisplayCurrency,
    withSign: false,
    currencyCode: txDisplayCurrency,
  })

  const secondaryAmount =
    settlementAmount.currency === txDisplayCurrency
      ? undefined
      : formatMoneyAmount({ moneyAmount: settlementAmount })

  const amounts = secondaryAmount
    ? formattedDisplayAmount + ` (${secondaryAmount})`
    : formattedDisplayAmount

  return (
    <View style={styles.walletSummaryContainer}>
      <View style={styles.currencyTagContainer}>
        <CurrencyPill
          currency={settlementAmount.currency}
          containerSize="medium"
          label={
            settlementAmount.currency === WalletCurrency.Btc
              ? LL.common.bitcoin()
              : LL.common.dollar()
          }
        />
      </View>
      <View style={styles.amountsContainer}>
        <Text type={"p2"}>{walletName}</Text>
        <Text>
          {amountTypeToSymbol[amountType]}
          {amounts}
        </Text>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  walletSummaryContainer: {
    backgroundColor: colors.grey5,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    padding: 14,
  },
  amountsContainer: {
    marginLeft: 16,
  },
  currencyTagContainer: {},
}))
