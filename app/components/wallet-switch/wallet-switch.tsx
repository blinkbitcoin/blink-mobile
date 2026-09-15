import React, { useEffect, useRef } from "react"
import { View } from "react-native"
import Animated from "react-native-reanimated"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { useAlternatingSpin } from "@app/components/animations"
import { CurrencyPill, useEqualPillWidth } from "@app/components/atomic/currency-pill"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"

type WalletSwitchProps = {
  currency: WalletCurrency
  /** Hides the swap icon (keeping its space) where there is no other wallet to switch to. */
  canToggle: boolean
}

/**
 * The swap icon and wallet pill of a Bitcoin/Dollar switch. Both pills take the width of the
 * wider label, so the switch keeps its size in either state; the icon spins on each switch.
 */
export const WalletSwitch: React.FC<WalletSwitchProps> = ({ currency, canToggle }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { widthStyle, onPillLayout } = useEqualPillWidth({
    labels: { BTC: LL.common.bitcoin(), USD: LL.common.dollar() },
  })
  const { triggerSpin, spinStyle } = useAlternatingSpin()

  const previousCurrency = useRef(currency)
  useEffect(() => {
    if (previousCurrency.current === currency) return
    previousCurrency.current = currency
    triggerSpin()
  }, [currency, triggerSpin])

  return (
    <View style={styles.container}>
      <Animated.View style={[spinStyle, !canToggle && styles.iconHidden]}>
        <GaloyIcon name="refresh" size={16} color={colors.grey1} />
      </Animated.View>
      <CurrencyPill
        currency={currency}
        containerSize="medium"
        containerStyle={widthStyle}
        onLayout={onPillLayout(currency)}
      />
    </View>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  iconHidden: {
    opacity: 0,
  },
}))
