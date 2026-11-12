import React from "react"
import { View } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"

import { CurrencyPill } from "@app/components/atomic/currency-pill"
import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

export const WALLET_SUMMARY_TEST_ID = "wallet-summary"
export const WALLET_SUMMARY_SECONDARY_TEST_ID = "wallet-summary-balance-secondary"
export const WALLET_SUMMARY_SIZER_TEST_ID = "wallet-summary-balance-sizer"

type WalletSummaryProps = {
  currency: WalletCurrency
  balancePrimary: string
  balanceSecondary?: string
}

/**
 * A settled read-out of the wallet a transaction moved: its amount and pill on the static
 * grey7 surface, the same size as the send flow's wallet card but never a switch.
 */
export const WalletSummary: React.FC<WalletSummaryProps> = ({
  currency,
  balancePrimary,
  balanceSecondary,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const walletName =
    currency === WalletCurrency.Btc ? LL.common.bitcoin() : LL.common.dollar()

  return (
    <View
      {...testProps(WALLET_SUMMARY_TEST_ID)}
      style={styles.card}
      accessible
      accessibilityLabel={`${walletName}, ${balancePrimary}`}
    >
      <View style={styles.balances}>
        {/* An invisible two-line copy sets the height, so the card is the same size with or
            without a second denomination and still grows with the system text size. */}
        <View
          style={styles.sizer}
          testID={WALLET_SUMMARY_SIZER_TEST_ID}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.balancePrimary}>{balancePrimary}</Text>
          <Text style={styles.balanceSecondary}> </Text>
        </View>
        {/* The visible lines sit over it, centred: a dollar wallet shown in USD is one line. */}
        <View style={styles.balancesVisible}>
          <Text style={styles.balancePrimary}>{balancePrimary}</Text>
          {balanceSecondary ? (
            <Text
              style={styles.balanceSecondary}
              {...testProps(WALLET_SUMMARY_SECONDARY_TEST_ID)}
            >
              {balanceSecondary}
            </Text>
          ) : null}
        </View>
      </View>
      <CurrencyPill currency={currency} containerSize="medium" />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 20,
    minHeight: 67,
    backgroundColor: colors.surfaceStatic,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.transparent,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  balances: {
    flex: 1,
  },
  sizer: {
    opacity: 0,
  },
  balancesVisible: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
  },
  balancePrimary: {
    fontFamily: "SourceSansPro-Bold",
    fontSize: 16,
    lineHeight: 22,
    color: colors.textOnBackground,
  },
  balanceSecondary: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textOnBackground,
  },
}))
