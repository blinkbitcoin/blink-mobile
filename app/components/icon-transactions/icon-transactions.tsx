import * as React from "react"
import { View } from "react-native"

import OnchainIcon from "@app/assets/icons-redesign/bitcoin.svg"
import DollarIcon from "@app/assets/icons-redesign/dollar.svg"
import LightningIcon from "@app/assets/icons-redesign/lightning.svg"
import { WalletCurrency } from "@app/graphql/generated"
import { useTheme } from "@rn-vui/themed"

type Props = {
  isReceive: boolean
  pending?: boolean
  walletCurrency: WalletCurrency
  onChain: boolean
}

export const IconTransaction: React.FC<Props> = ({
  walletCurrency,
  onChain = false,
  pending = false,
}) => {
  const {
    theme: { colors },
  } = useTheme()

  switch (walletCurrency) {
    case WalletCurrency.Btc:
      if (onChain && pending) return <OnchainIcon color={colors.grey3} />
      if (onChain && !pending) return <OnchainIcon color={colors.primary} />
      return <LightningIcon color={colors.primary} />
    case WalletCurrency.Usd:
      return <DollarIcon color={colors.primary} />
    default:
      return <View />
  }
}
