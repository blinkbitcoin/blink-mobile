import React from "react"
import { View } from "react-native"
import { makeStyles, Text, TextProps, useTheme } from "@rn-vui/themed"

import { WalletCurrency } from "@app/graphql/generated"

const BTC_TEXT = "Bitcoin"
const USD_TEXT = "Dollar"
const DEFAULT_TEXT_SIZE = "p3"

type ContainerSize = "small" | "medium" | "large"

const CONTAINER_SIZES: Record<ContainerSize, { horizontal: number; vertical: number }> = {
  small: { horizontal: 8, vertical: 4 },
  medium: { horizontal: 12, vertical: 5 },
  large: { horizontal: 16, vertical: 6 },
}

export const GaloyCurrencyBubbleText = ({
  currency,
  textSize,
  highlighted = true,
  containerSize = "small",
}: {
  currency: WalletCurrency
  textSize?: TextProps["type"]
  containerSize?: ContainerSize
  highlighted?: boolean
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const isBtc = currency === WalletCurrency.Btc

  return (
    <ContainerBubble
      text={isBtc ? BTC_TEXT : USD_TEXT}
      textSize={textSize}
      highlighted={highlighted}
      color={highlighted ? (isBtc ? colors.white : colors._white) : colors._white}
      backgroundColor={
        highlighted ? (isBtc ? colors.primary : colors._green) : colors.grey3
      }
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
  containerSize?: ContainerSize
}) => {
  const styles = useStyles({ backgroundColor, containerSize, color })

  return (
    <View style={styles.container}>
      <Text type={textSize || DEFAULT_TEXT_SIZE} style={styles.text}>
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
      containerSize: ContainerSize
      color?: string
    },
  ) => {
    const sizes = CONTAINER_SIZES[containerSize]
    return {
      container: {
        backgroundColor,
        paddingHorizontal: sizes.horizontal,
        paddingVertical: sizes.vertical,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
      },
      text: {
        color,
        fontWeight: "bold",
      },
    }
  },
)
