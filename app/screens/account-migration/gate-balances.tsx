import React from "react"
import { View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { InfoRow } from "@app/components/card-screen/info-row"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useCustodialWalletBalances } from "@app/screens/account-migration/hooks"
import { DisplayCurrency, toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"

/**
 * The gate's balances block: owns its query and formatting, and renders nothing until
 * the query settles with data so unknown balances never show as zeros. Mounted only in
 * gate mode, so the other modes never pay for this plumbing.
 */
export const GateBalances: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const { btcBalanceSats, usdBalanceCents, isReady } = useCustodialWalletBalances()
  const { formatMoneyAmount, formatDisplayAndWalletAmount } = useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()

  if (!isReady) return null

  const btcWalletAmount = toBtcMoneyAmount(btcBalanceSats)
  const usdWalletAmount = toUsdMoneyAmount(usdBalanceCents)
  const btcBalance = convertMoneyAmount
    ? formatDisplayAndWalletAmount({
        primaryAmount: btcWalletAmount,
        walletAmount: btcWalletAmount,
        displayAmount: convertMoneyAmount(btcWalletAmount, DisplayCurrency),
      })
    : formatMoneyAmount({ moneyAmount: btcWalletAmount })
  const usdBalance = formatMoneyAmount({ moneyAmount: usdWalletAmount })

  return (
    <View style={styles.balances}>
      <InfoRow label={LL.AccountMigration.bitcoinBalance()} value={btcBalance} />
      <InfoRow label={LL.AccountMigration.dollarBalance()} value={usdBalance} />
    </View>
  )
}

const useStyles = makeStyles(() => ({
  balances: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 260,
    gap: 5,
    paddingHorizontal: 20,
  },
}))
