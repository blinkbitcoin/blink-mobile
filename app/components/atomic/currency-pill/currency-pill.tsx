import React from "react"
import { View } from "react-native"
import { useTheme, TextProps, Text, makeStyles } from "@rn-vui/themed"

import { WalletCurrency } from "@app/graphql/generated"

export const CurrencyPill = ({
  currency,
  label,
  textSize,
  highlighted = true,
  containerSize = "small",
}: {
  currency?: WalletCurrency | "ALL"
  label?: string
  textSize?: TextProps["type"]
  containerSize?: "small" | "medium" | "large"
  highlighted?: boolean
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const getCurrencyProps = () => {
    switch (currency) {
      case WalletCurrency.Btc:
        return {
          defaultText: "BTC",
          color: highlighted ? colors.white : colors._white,
          backgroundColor: highlighted ? colors.primary : colors.grey3,
        }
      case WalletCurrency.Usd:
        return {
          defaultText: "USD",
          color: highlighted ? colors._white : colors._white,
          backgroundColor: highlighted ? colors._green : colors.grey3,
        }
      default:
        return {
          defaultText: "ALL",
          color: colors.primary,
          backgroundColor: colors.transparent,
          borderColor: colors.primary,
        }
    }
  }

  const currencyProps = getCurrencyProps()
  const text = label ?? currencyProps.defaultText

  return (
    <ContainerBubble
      text={text}
      textSize={textSize}
      color={currencyProps.color}
      backgroundColor={currencyProps.backgroundColor}
      borderColor={currencyProps.borderColor}
      containerSize={containerSize}
    />
  )
}

const ContainerBubble = ({
  text,
  textSize,
  color,
  backgroundColor,
  containerSize = "small",
  borderColor,
}: {
  text: string
  textSize?: TextProps["type"]
  color?: string
  backgroundColor?: string
  containerSize?: "small" | "medium" | "large"
  borderColor?: string
}) => {
  const styles = useStyles({ backgroundColor, containerSize, color, borderColor })

  return (
    <View style={styles.container}>
      <Text type={textSize || "p3"} style={styles.text}>
        {text}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(
  (
    _theme,
    {
      backgroundColor,
      containerSize,
      color,
      borderColor,
    }: {
      backgroundColor?: string
      containerSize: "small" | "medium" | "large"
      color?: string
      borderColor?: string
    },
  ) => ({
    container: {
      backgroundColor,
      paddingHorizontal:
        containerSize === "small" ? 5 : containerSize === "medium" ? 5 : 15,
      paddingVertical: containerSize === "small" ? 3 : containerSize === "medium" ? 5 : 5,
      minWidth: containerSize === "small" ? 40 : containerSize === "medium" ? 60 : 80,
      minHeight: containerSize === "small" ? 20 : containerSize === "medium" ? 30 : 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderColor: borderColor ?? "transparent",
      borderWidth: 1,
    },
    text: {
      color,
      fontWeight: "bold",
    },
  }),
)
