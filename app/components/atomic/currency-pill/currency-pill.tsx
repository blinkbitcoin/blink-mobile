import React from "react"
import { LayoutChangeEvent, StyleProp, View, ViewStyle } from "react-native"
import { useTheme, Text, makeStyles } from "@rn-vui/themed"

import { WalletCurrency } from "@app/graphql/generated"

export const CURRENCY_PILL_PADDING_HORIZONTAL = 11
export const CURRENCY_PILL_BORDER_WIDTH = 1

export const CURRENCY_PILL_TEXT_STYLE = {
  fontSize: 14,
  fontWeight: "bold",
} as const

export const CurrencyPill = ({
  currency,
  label,
  highlighted = true,
  containerSize = "small",
  containerStyle,
  onLayout,
}: {
  currency?: WalletCurrency | "ALL"
  label?: string
  containerSize?: "small" | "medium" | "large"
  highlighted?: boolean
  containerStyle?: StyleProp<ViewStyle>
  onLayout?: (event: LayoutChangeEvent) => void
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
      color={currencyProps.color}
      backgroundColor={currencyProps.backgroundColor}
      borderColor={currencyProps.borderColor}
      containerSize={containerSize}
      containerStyle={containerStyle}
      onLayout={onLayout}
    />
  )
}

const ContainerBubble = ({
  text,
  color,
  backgroundColor,
  containerSize = "small",
  borderColor,
  containerStyle,
  onLayout,
}: {
  text: string
  color?: string
  backgroundColor?: string
  containerSize?: "small" | "medium" | "large"
  borderColor?: string
  containerStyle?: StyleProp<ViewStyle>
  onLayout?: (event: LayoutChangeEvent) => void
}) => {
  const styles = useStyles({ backgroundColor, containerSize, color, borderColor })

  return (
    <View style={[styles.container, containerStyle]} onLayout={onLayout}>
      <Text type="p3" style={styles.text}>
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
      paddingHorizontal: CURRENCY_PILL_PADDING_HORIZONTAL,
      paddingVertical: 8,
      minWidth: containerSize === "small" ? 40 : containerSize === "medium" ? 60 : 80,
      minHeight: containerSize === "small" ? 20 : containerSize === "medium" ? 30 : 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderColor: borderColor ?? "transparent",
      borderWidth: CURRENCY_PILL_BORDER_WIDTH,
      flexShrink: 0,
    },
    text: {
      color,
      ...CURRENCY_PILL_TEXT_STYLE,
    },
  }),
)
