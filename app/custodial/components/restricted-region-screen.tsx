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

import { RestrictedRegionBody } from "@app/components/restricted-region/restricted-region-body"

/** Every custodial function is Blink-served, so the block covers the whole session
 *  and offers no way back into the app while it holds. */
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
  const btcWallet = getBtcWallet(wallets)
  const usdWallet = getUsdWallet(wallets)
  const hasBalances = btcWallet !== undefined && usdWallet !== undefined
  const btcAmount = toBtcMoneyAmount(btcWallet?.balance ?? NaN)
  const usdAmount = toUsdMoneyAmount(usdWallet?.balance ?? NaN)

  const btcFiat = moneyAmountToDisplayCurrencyString({ moneyAmount: btcAmount })
  const bitcoinNativeBalance = formatMoneyAmount({ moneyAmount: btcAmount })
  const hasBtcFiat = Boolean(btcFiat)
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
          <View style={styles.headerSpacer} />
          <View style={styles.hero}>
            <GaloyIcon
              name="warning"
              size={32}
              color={colors.primary}
              backgroundColor={colors.grey5}
              containerSize={44}
            />
            <View style={styles.heroText}>
              <Text type="h2" bold style={styles.title}>
                {LL.RestrictedRegion.title()}
              </Text>
              <RestrictedRegionBody type="p2" style={styles.body} />
            </View>
          </View>

          {hasBalances && (
            <View style={styles.balances}>
              <View style={styles.balanceRow}>
                <Text type="p3" style={styles.balanceLabel}>
                  {LL.common.btcAccount()}
                </Text>
                {hasBtcFiat ? (
                  <Text type="p3" style={styles.balanceValue}>
                    <Text type="p3" bold style={styles.balanceValueBold}>
                      {`${bitcoinNativeBalance} `}
                    </Text>
                    <Text type="p3" style={styles.balanceValue}>
                      {`(${btcFiat})`}
                    </Text>
                  </Text>
                ) : (
                  <Text type="p3" bold style={styles.balanceValueBold}>
                    {bitcoinNativeBalance}
                  </Text>
                )}
              </View>
              <View style={styles.balanceRow}>
                <Text type="p3" style={styles.balanceLabel}>
                  {LL.common.usdAccount()}
                </Text>
                <Text type="p3" bold style={styles.balanceValueBold}>
                  {dollarBalance}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.spacer} />
          <View style={styles.actions}>
            <GaloyPrimaryButton
              title={LL.RestrictedRegion.contactSupport()}
              onPress={openSupport}
              {...testProps("restricted-region-contact-support")}
            />
            {/* The external browser is deliberate here: this block renders inside a
                native Modal, which nothing (InAppBrowser included) can present above.
                The dismissible self-custodial modal uses the in-app browser instead. */}
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
  },
  headerSpacer: {
    height: 60,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    rowGap: 14,
  },
  heroText: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingHorizontal: 28,
    rowGap: 8,
  },
  title: {
    textAlign: "center",
    fontWeight: "700",
  },
  body: {
    lineHeight: 22,
    textAlign: "center",
    color: colors.black,
  },
  balances: {
    alignSelf: "stretch",
    paddingHorizontal: 45,
    rowGap: 10,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  balanceLabel: {
    lineHeight: 20,
    color: colors.grey2,
  },
  balanceValue: {
    lineHeight: 20,
  },
  balanceValueBold: {
    lineHeight: 20,
    fontWeight: "700",
  },
  spacer: {
    flex: 1,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    rowGap: 10,
  },
}))
