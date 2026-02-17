import React from "react"
import { LayoutChangeEvent, StyleProp, View, ViewStyle } from "react-native"
import { useTheme, Text, makeStyles } from "@rn-vui/themed"

import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"

export const CURRENCY_PILL_PADDING_HORIZONTAL = 8
export const CURRENCY_PILL_BORDER_WIDTH = 1

export const CURRENCY_PILL_TEXT_STYLE = {
  fontSize: 14,
  fontWeight: "bold",
} as const

export const CurrencyPill = ({
  currency,
  label,
  highlighted = true,
  variant = "filled",
  containerSize = "small",
  containerStyle,
  onLayout,
}: {
  currency?: WalletCurrency | "ALL"
  label?: string
  containerSize?: "small" | "medium" | "large"
  highlighted?: boolean
  variant?: "filled" | "outlined"
  containerStyle?: StyleProp<ViewStyle>
  onLayout?: (event: LayoutChangeEvent) => void
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const getCurrencyProps = () => {
    if (variant === "outlined") {
      return {
        defaultText: "",
        color: colors.grey1,
        backgroundColor: colors.transparent,
        borderColor: colors.grey1,
      }
    }

    switch (currency) {
      case WalletCurrency.Btc:
        return {
          defaultText: LL.common.bitcoin(),
          color: highlighted ? colors.white : colors._white,
          backgroundColor: highlighted ? colors.primary : colors.grey3,
        }
      case WalletCurrency.Usd:
        return {
          defaultText: LL.common.dollar(),
          color: highlighted ? colors._white : colors._white,
          backgroundColor: highlighted ? colors._green : colors.grey3,
        }
      default:
        return {
          defaultText: currency === "ALL" ? LL.common.all() : "ALL",
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
      variant={variant}
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
  variant = "filled",
  containerStyle,
  onLayout,
}: {
  text: string
  color?: string
  backgroundColor?: string
  containerSize?: "small" | "medium" | "large"
  borderColor?: string
  variant?: "filled" | "outlined"
  containerStyle?: StyleProp<ViewStyle>
  onLayout?: (event: LayoutChangeEvent) => void
}) => {
  const styles = useStyles({ backgroundColor, containerSize, color, borderColor })
  const isOutlined = variant === "outlined"

  return (
    <View
      style={[styles.container, isOutlined && styles.outlinedContainer, containerStyle]}
      onLayout={onLayout}
    >
      <Text type="p3" style={[styles.text, isOutlined && styles.outlinedText]}>
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
      paddingVertical: 7,
      minWidth: containerSize === "small" ? 40 : containerSize === "medium" ? 60 : 80,
      minHeight: containerSize === "small" ? 20 : containerSize === "medium" ? 30 : 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderColor: borderColor ?? "transparent",
      borderWidth: CURRENCY_PILL_BORDER_WIDTH,
      flexShrink: 0,
    },
    outlinedContainer: {
      minWidth: 52,
      paddingVertical: 4,
      paddingHorizontal: 11,
    },
    text: {
      color,
      ...CURRENCY_PILL_TEXT_STYLE,
    },
    outlinedText: {
      fontFamily: "Source Sans Pro",
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 22,
    },
  }),
)
