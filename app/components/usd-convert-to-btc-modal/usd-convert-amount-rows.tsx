import * as React from "react"
import { View } from "react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { UsdMoneyAmount } from "@app/types/amounts"
import { makeStyles, Text } from "@rn-vui/themed"

type Props = {
  usdWalletBalance: UsdMoneyAmount
}

export const UsdConvertAmountRows: React.FC<Props> = ({ usdWalletBalance }) => {
  const { LL } = useI18nContext()
  const { formatMoneyAmount } = useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()
  const styles = useStyles()

  const btcAmount = convertMoneyAmount?.(usdWalletBalance, WalletCurrency.Btc)

  const youHaveValue = formatMoneyAmount({ moneyAmount: usdWalletBalance })
  const youGetValue = btcAmount
    ? formatMoneyAmount({ moneyAmount: btcAmount, isApproximate: true })
    : ""

  return (
    <View style={styles.container}>
      <Text style={styles.body}>{LL.ConvertDollarToBitcoinModal.body()}</Text>
      <View style={styles.rows}>
        <View style={styles.row}>
          <Text style={styles.label}>{LL.ConvertDollarToBitcoinModal.youHave()}</Text>
          <Text style={styles.value}>{youHaveValue}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{LL.ConvertDollarToBitcoinModal.youGet()}</Text>
          <Text style={styles.value}>{youGetValue}</Text>
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    width: "100%",
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
    color: colors.black,
    textAlign: "center",
  },
  rows: {
    marginTop: 24,
    rowGap: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    color: colors.grey3,
  },
  value: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.black,
  },
}))
