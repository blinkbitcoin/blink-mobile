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
  currency: WalletCurrency
  textSize?: TextProps["type"]
  containerSize?: "small" | "medium" | "large"
  highlighted?: boolean
}) => {
  const {
    theme: { colors },
  } = useTheme()

  return currency === WalletCurrency.Btc ? (
    <ContainerBubble
      text="BTC"
      textSize={textSize}
      highlighted={highlighted}
      color={highlighted ? colors.white : colors._white}
      backgroundColor={highlighted ? colors.primary : colors.grey3}
      containerSize={containerSize}
    />
  ) : (
    <ContainerBubble
      text="USD"
      textSize={textSize}
      highlighted={highlighted}
      color={highlighted ? colors._white : colors._white}
      backgroundColor={highlighted ? colors._green : colors.grey3}
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
}: {
  text: string
  textSize?: TextProps["type"]
  highlighted?: boolean
  color?: string
  backgroundColor?: string
  containerSize?: "small" | "medium" | "large"
}) => {
  const styles = useStyles({ backgroundColor, containerSize, color })

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
    }: {
      backgroundColor?: string
      containerSize: "small" | "medium" | "large"
      color?: string
    },
  ) => ({
    container: {
      backgroundColor,
      paddingHorizontal:
        containerSize === "small" ? 8 : containerSize === "medium" ? 12 : 16,
      paddingVertical: containerSize === "small" ? 4 : containerSize === "medium" ? 5 : 6,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    text: {
      color,
      fontWeight: "bold",
    },
  }),
)
