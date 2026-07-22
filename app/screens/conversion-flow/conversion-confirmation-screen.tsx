import React, { useMemo } from "react"
import { TouchableOpacity, View } from "react-native"
import { makeStyles, useTheme, Text } from "@rn-vui/themed"
import { PanGestureHandler, ScrollView } from "react-native-gesture-handler"
import {
  CommonActions,
  NavigationProp,
  RouteProp,
  useNavigation,
} from "@react-navigation/native"

import { useConversionScreenQuery, WalletCurrency } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { SATS_PER_BTC, usePriceConversion } from "@app/hooks"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useIntraLedgerConversion } from "@app/hooks/use-intra-ledger-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toBtcMoneyAmount } from "@app/types/amounts"
import { WalletDescriptor } from "@app/types/wallets"

import { ConversionFeeRow } from "./conversion-fee-row"
import { useSelfCustodialConversion } from "./hooks"

import { Screen } from "@app/components/screen"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { CurrencyPill, useEqualPillWidth } from "@app/components/atomic/currency-pill"
import GaloySliderButton from "@app/components/atomic/galoy-slider-button/galoy-slider-button"

type Props = {
  route: RouteProp<RootStackParamList, "conversionConfirmation">
}

export const ConversionConfirmationScreen: React.FC<Props> = ({ route }) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const navigation =
    useNavigation<NavigationProp<RootStackParamList, "conversionConfirmation">>()

  const { formatMoneyAmount, displayCurrency, moneyAmountToDisplayCurrencyString } =
    useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()

  const { fromWalletCurrency, moneyAmount, isMigrationConversion } = route.params
  const isAuthed = useIsAuthed()
  const { isSelfCustodial, wallets: activeWallets } = useActiveWallet()

  const { LL } = useI18nContext()
  const { widthStyle: pillWidthStyle, onPillLayout } = useEqualPillWidth()

  const { data } = useConversionScreenQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed || isSelfCustodial,
  })

  const selfCustodialBtcWallet = activeWallets.find(
    (w) => w.walletCurrency === WalletCurrency.Btc,
  )
  const selfCustodialUsdWallet = activeWallets.find(
    (w) => w.walletCurrency === WalletCurrency.Usd,
  )
  const btcWallet = isSelfCustodial
    ? selfCustodialBtcWallet && {
        id: selfCustodialBtcWallet.id,
        balance: selfCustodialBtcWallet.balance.amount,
        walletCurrency: selfCustodialBtcWallet.walletCurrency,
      }
    : getBtcWallet(data?.me?.defaultAccount?.wallets)
  const usdWallet = isSelfCustodial
    ? selfCustodialUsdWallet && {
        id: selfCustodialUsdWallet.id,
        balance: selfCustodialUsdWallet.balance.amount,
        walletCurrency: selfCustodialUsdWallet.walletCurrency,
      }
    : getUsdWallet(data?.me?.defaultAccount?.wallets)

  const btcToUsdRate = useMemo(() => {
    if (!convertMoneyAmount) return null

    const oneBtc = toBtcMoneyAmount(SATS_PER_BTC)
    const usdEquivalent = convertMoneyAmount(oneBtc, WalletCurrency.Usd)

    return formatMoneyAmount({
      moneyAmount: usdEquivalent,
      isApproximate: false,
    })
  }, [convertMoneyAmount, formatMoneyAmount])

  /** Resets to Home with the success screen on top, dropping the convert screens. A migration
   *  conversion tags the success screen so it hands off to the migration entry (as the Settings
   *  row does) instead of ending on Home. */
  const navigateToSuccess = () =>
    navigation.dispatch((state) => {
      const routes = [
        { name: "Primary" },
        {
          name: "conversionSuccess",
          params: { returnToMigration: isMigrationConversion },
        },
      ]
      return CommonActions.reset({ ...state, routes, index: routes.length - 1 })
    })

  const nonCustodialConversion = useSelfCustodialConversion({
    fromCurrency: fromWalletCurrency,
    moneyAmount,
    enabled: isSelfCustodial,
    onSuccess: navigateToSuccess,
  })

  const intraLedgerConversion = useIntraLedgerConversion({ onSuccess: navigateToSuccess })

  const activeConversion = isSelfCustodial
    ? nonCustodialConversion
    : intraLedgerConversion
  const isLoading = activeConversion.loading

  if (
    (!isSelfCustodial && !data?.me) ||
    !usdWallet ||
    !btcWallet ||
    !convertMoneyAmount
  ) {
    // TODO: handle errors and or provide some loading state
    return null
  }

  const fromWallet: WalletDescriptor<WalletCurrency> =
    fromWalletCurrency === WalletCurrency.Btc
      ? { id: btcWallet.id, currency: WalletCurrency.Btc }
      : { id: usdWallet.id, currency: WalletCurrency.Usd }

  const toWallet: WalletDescriptor<WalletCurrency> =
    fromWalletCurrency === WalletCurrency.Btc
      ? { id: usdWallet.id, currency: WalletCurrency.Usd }
      : { id: btcWallet.id, currency: WalletCurrency.Btc }

  const fromAmount = convertMoneyAmount(moneyAmount, fromWallet.currency)
  const toAmount = convertMoneyAmount(moneyAmount, toWallet.currency)

  const fromWalletLabel =
    fromWallet.currency === WalletCurrency.Btc ? LL.common.bitcoin() : LL.common.dollar()
  const toWalletLabel =
    toWallet.currency === WalletCurrency.Btc ? LL.common.bitcoin() : LL.common.dollar()

  const fromWalletBalanceFormatted = formatMoneyAmount({ moneyAmount: fromAmount })
  const fromSatsFormatted =
    fromWallet.currency === WalletCurrency.Usd && displayCurrency === WalletCurrency.Usd
      ? null
      : moneyAmountToDisplayCurrencyString({
          moneyAmount: fromAmount,
          isApproximate: true,
        })

  const toWalletBalanceFormatted = formatMoneyAmount({
    moneyAmount: toAmount,
    isApproximate: true,
  })
  const toSatsFormatted =
    toWallet.currency === WalletCurrency.Usd && displayCurrency === WalletCurrency.Usd
      ? null
      : moneyAmountToDisplayCurrencyString({
          moneyAmount: toAmount,
          isApproximate: true,
        })

  const payWallet = async () => {
    if (isSelfCustodial) {
      /** A failed conversion invalidates the pinned quote, so the next swipe
       *  retries the quote instead of stranding a permanently disabled slider. */
      if (nonCustodialConversion.hasQuoteError) {
        nonCustodialConversion.requote()
        return
      }
      await nonCustodialConversion.execute()
      return
    }
    await intraLedgerConversion.execute({
      fromWallet,
      toWallet,
      fromAmount: fromAmount.amount,
    })
  }

  const visibleErrorMessage = activeConversion.errorMessage

  const isSelfCustodialQuotePending =
    isSelfCustodial &&
    !nonCustodialConversion.canExecute &&
    !nonCustodialConversion.hasQuoteError

  const isSliderDisabled = isLoading || isSelfCustodialQuotePending

  return (
    <Screen>
      <ScrollView style={styles.scrollViewContainer}>
        <View style={styles.conversionRate}>
          <Text type="p2" style={styles.conversionRateText}>
            1 BTC = {btcToUsdRate}
          </Text>
        </View>
        <View style={styles.conversionInfoCard}>
          <View style={styles.fromFieldContainer}>
            <CurrencyPill
              currency={fromWallet.currency}
              containerSize="medium"
              containerStyle={pillWidthStyle}
              onLayout={onPillLayout(fromWallet.currency)}
            />

            <View style={styles.walletSelectorBalanceContainer}>
              <Text style={styles.conversionInfoFieldValue}>
                {fromWalletBalanceFormatted}
              </Text>
              <Text style={styles.conversionInfoFieldConvertValue}>
                {fromSatsFormatted}
              </Text>
            </View>
          </View>
          <View style={styles.walletSeparator}>
            <View style={styles.line}></View>
            <TouchableOpacity style={styles.switchButton} disabled>
              <GaloyIcon name="arrow-down" color={colors.grey3} size={25} />
            </TouchableOpacity>
          </View>
          <View style={styles.toFieldContainer}>
            <CurrencyPill
              currency={toWallet.currency}
              containerSize="medium"
              containerStyle={pillWidthStyle}
              onLayout={onPillLayout(toWallet.currency)}
            />
            <View style={styles.walletSelectorBalanceContainer}>
              <Text style={styles.conversionInfoFieldValue}>
                {toWalletBalanceFormatted}
              </Text>
              <Text style={styles.conversionInfoFieldConvertValue}>
                {toSatsFormatted}
              </Text>
            </View>
          </View>
        </View>
        {isSelfCustodial && (
          <ConversionFeeRow
            feeText={nonCustodialConversion.feeText}
            isLoading={nonCustodialConversion.isQuoting}
            hasError={nonCustodialConversion.hasQuoteError}
          />
        )}
        <View style={styles.infoContainer}>
          <Text style={styles.conversionInfoFieldTitle}>
            {toWallet.currency === WalletCurrency.Btc
              ? LL.ConversionConfirmationScreen.infoBitcoin()
              : LL.ConversionConfirmationScreen.infoDollar()}
          </Text>
        </View>
        {visibleErrorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{visibleErrorMessage}</Text>
          </View>
        )}
      </ScrollView>
      <PanGestureHandler>
        <View style={styles.sliderContainer}>
          <GaloySliderButton
            isLoading={isLoading}
            initialText={LL.ConversionConfirmationScreen.transferButtonText({
              fromWallet: fromWalletLabel,
              toWallet: toWalletLabel,
            })}
            loadingText={LL.SendBitcoinConfirmationScreen.slideConfirming()}
            onSwipe={payWallet}
            disabled={isSliderDisabled}
          />
        </View>
      </PanGestureHandler>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scrollViewContainer: {
    flexDirection: "column",
  },
  conversionInfoCard: {
    margin: 20,
    backgroundColor: colors.grey5,
    borderRadius: 13,
    padding: 20,
  },
  conversionRate: {
    marginHorizontal: 20,
    padding: 20,
    paddingBottom: 0,
    marginBottom: 0,
  },
  conversionRateText: {
    color: colors.grey0,
  },
  conversionInfoFieldTitle: { color: colors.grey1, lineHeight: 25, fontWeight: "400" },
  conversionInfoFieldValue: {
    color: colors.grey1,
    fontWeight: "bold",
    fontSize: 20,
  },
  conversionInfoFieldConvertValue: {
    color: colors.grey2,
    fontSize: 14,
    fontWeight: "normal",
  },
  errorContainer: {
    marginBottom: 10,
  },
  errorText: {
    color: colors.error,
    textAlign: "center",
  },
  fromFieldContainer: {
    flexDirection: "row",
    marginBottom: 15,
    alignItems: "center",
  },
  walletSelectorBalanceContainer: {
    marginTop: 5,
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
  walletSeparator: {
    flexDirection: "row",
    height: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  line: {
    backgroundColor: colors.grey4,
    height: 1,
    flex: 1,
  },
  switchButton: {
    position: "absolute",
    left: 100,
    height: 43,
    width: 43,
    borderRadius: 50,
    backgroundColor: colors.grey4,
    justifyContent: "center",
    alignItems: "center",
  },
  toFieldContainer: {
    flexDirection: "row",
    marginTop: 15,
    alignItems: "center",
  },
  infoContainer: {
    marginHorizontal: 20,
    backgroundColor: colors.grey5,
    borderRadius: 6,
    padding: 20,
    paddingVertical: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.black,
  },
  sliderContainer: {
    padding: 20,
  },
}))
