import React from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "../galoy-icon"

export const GaloyCurrencyBubble = ({
  currency,
  iconSize: overrideIconSize,
  highlighted = true,
}: {
  currency: WalletCurrency
  iconSize?: number
  highlighted?: boolean
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const iconSize = overrideIconSize || 24

  return currency === WalletCurrency.Btc ? (
    <GaloyIcon
      name="bitcoin"
      size={iconSize}
      color={highlighted ? colors.white : colors._white}
      backgroundColor={highlighted ? colors.primary : colors.grey3}
    />
  ) : (
    <GaloyIcon
      name="dollar"
      size={iconSize}
      color={colors._white}
      backgroundColor={highlighted ? colors._green : colors.grey3}
    />
  )
}
