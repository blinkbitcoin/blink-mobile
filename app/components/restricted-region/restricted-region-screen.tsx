import * as React from "react"
import { Linking, Modal, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { BLOCKED_COUNTRIES_FAQ_LINK } from "@app/config"
import { useWalletOverviewScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useContactSupport } from "@app/hooks/use-contact-support"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

/** The custodial variant: every custodial function is Blink-served, so the block covers
 *  the whole session and offers no way back into the app while it holds. */
export const RestrictedRegionScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const isAuthed = useIsAuthed()
  const { data } = useWalletOverviewScreenQuery({ skip: !isAuthed })
  const { formatMoneyAmount, moneyAmountToDisplayCurrencyString } = useDisplayCurrency()
  const { openSupport } = useContactSupport()

  const wallets = data?.me?.defaultAccount?.wallets
  const hasBalances = wallets !== undefined
  const btcAmount = toBtcMoneyAmount(getBtcWallet(wallets)?.balance ?? NaN)
  const usdAmount = toUsdMoneyAmount(getUsdWallet(wallets)?.balance ?? NaN)

  const btcFiat = moneyAmountToDisplayCurrencyString({
    moneyAmount: btcAmount,
    isApproximate: true,
  })
  const bitcoinBalance = `${formatMoneyAmount({ moneyAmount: btcAmount })}${
    btcFiat ? ` (${btcFiat})` : ""
  }`
  const dollarBalance = moneyAmountToDisplayCurrencyString({ moneyAmount: usdAmount })

  /** A native modal, not an in-tree overlay: nothing renders above it, the Android back
   *  button cannot reach the app behind it, and screen readers treat it as modal. */
  return (
    <Modal
      visible={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={blockBackPress}
      {...testProps("restricted-region-screen-host")}
    >
      <View style={styles.overlay} {...testProps("restricted-region-screen")}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <GaloyIcon name="warning" size={80} color={colors.warning} />
            <Text type="h1" bold style={styles.title}>
              {LL.RestrictedRegion.title()}
            </Text>
            <Text style={styles.body}>
              {LL.RestrictedRegion.body()}
              {"\n\n"}
              {LL.RestrictedRegion.bodyReturn()}
            </Text>

            {hasBalances && (
              <View style={styles.balances}>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>{LL.common.btcAccount()}</Text>
                  <Text bold>{bitcoinBalance}</Text>
                </View>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>{LL.common.usdAccount()}</Text>
                  <Text bold>{dollarBalance}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <GaloyPrimaryButton
              title={LL.RestrictedRegion.contactSupport()}
              onPress={openSupport}
              {...testProps("restricted-region-contact-support")}
            />
            <GaloySecondaryButton
              title={LL.RestrictedRegion.learnMore()}
              onPress={() => Linking.openURL(BLOCKED_COUNTRIES_FAQ_LINK)}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const blockBackPress = () => {}

const useStyles = makeStyles(({ colors }) => ({
  overlay: {
    flex: 1,
    backgroundColor: colors.white,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginTop: 20,
    textAlign: "center",
  },
  body: {
    marginTop: 16,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: colors.black,
  },
  balances: {
    marginTop: 28,
    alignSelf: "stretch",
    rowGap: 10,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceLabel: {
    color: colors.grey2,
  },
  actions: {
    rowGap: 6,
  },
}))
