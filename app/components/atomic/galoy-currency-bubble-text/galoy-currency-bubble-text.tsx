import React from "react"
import { View } from "react-native"
import { useTheme, TextProps, Text, makeStyles } from "@rneui/themed"

import { WalletCurrency } from "@app/graphql/generated"

export const GaloyCurrencyBubbleText = ({
  currency,
  textSize,
  highlighted = true,
  containerSize = "small",
}: {
  currency?: WalletCurrency | "ALL"
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
          text: "BTC",
          color: highlighted ? colors.white : colors._white,
          backgroundColor: highlighted ? colors.primary : colors.grey3,
        }
      case WalletCurrency.Usd:
        return {
          text: "USD",
          color: highlighted ? colors._white : colors._white,
          backgroundColor: highlighted ? colors._green : colors.grey3,
        }
      default:
        return {
          text: "ALL",
          color: colors.primary,
          backgroundColor: colors.transparent,
          borderColor: colors.primary,
        }
    }
  }

  const currencyProps = getCurrencyProps()

  return (
    <ContainerBubble
      text={currencyProps.text}
      textSize={textSize}
      highlighted={highlighted}
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
  highlighted?: boolean
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
        containerSize === "small" ? 7 : containerSize === "medium" ? 11 : 15,
      paddingVertical: containerSize === "small" ? 3 : containerSize === "medium" ? 3 : 5,
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
