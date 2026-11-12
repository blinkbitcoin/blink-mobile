import React, { FC } from "react"
import { Text, View } from "react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { makeStyles, useTheme } from "@rn-vui/themed"

const useStyles = makeStyles(() => ({
  currencyTag: {
    borderRadius: 10,
    height: 30,
    width: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  currencyText: {
    fontSize: 12,
  },
}))

type CurrencyTagProps = {
  walletCurrency: WalletCurrency
}

export const CurrencyTag: FC<CurrencyTagProps> = ({ walletCurrency }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const currencyStyling = {
    BTC: {
      textColor: colors.textOnAccent,
      backgroundColor: colors.accent,
    },
    USD: {
      textColor: colors.textOnBackground,
      backgroundColor: colors.staticSuccess,
    },
  }

  return (
    <View
      style={{
        ...styles.currencyTag,
        backgroundColor: currencyStyling[walletCurrency].backgroundColor,
      }}
    >
      <Text
        style={{
          ...styles.currencyText,
          color: currencyStyling[walletCurrency].textColor,
        }}
      >
        {walletCurrency}
      </Text>
    </View>
  )
}
