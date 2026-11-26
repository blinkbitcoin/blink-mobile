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
import { CARD, toBtcMoneyAmount } from "@app/types/amounts"
import { WalletDescriptor } from "@app/types/wallets"

import { ConversionFeeRow } from "./conversion-fee-row"
import { useCardTopUp, useCardWithdrawal, useSelfCustodialConversion } from "./hooks"
import { settlementCurrencyOf, TransferBalance } from "./transfer-balances"

import { Screen } from "@app/components/screen"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { CurrencyPill, useEqualPillWidth } from "@app/components/atomic/currency-pill"
import GaloySliderButton from "@app/components/atomic/galoy-slider-button/galoy-slider-button"
import { staticSurface } from "@app/rne-theme/surfaces"
import { fonts } from "@app/rne-theme/fonts"

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

  const { fromBalance, toBalance, moneyAmount, drainConversion } = route.params
  const fromCurrency = settlementCurrencyOf(fromBalance)
  const toCurrency = settlementCurrencyOf(toBalance)
  const isCardTopUp = toBalance === CARD
  const isCardWithdrawal = fromBalance === CARD
  /** Sats into or out of a bitcoin Card Balance move as they are, so the amount on the
   *  other side is exact rather than an estimate (design 160). */
  const isSameCurrency = fromCurrency === toCurrency
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
          ...(drainConversion ? { params: { returnTo: drainConversion } } : {}),
        },
      ]
      return CommonActions.reset({ ...state, routes, index: routes.length - 1 })
    })

  const nonCustodialConversion = useSelfCustodialConversion({
    fromCurrency,
    moneyAmount,
    enabled: isSelfCustodial,
    onSuccess: navigateToSuccess,
  })

  const intraLedgerConversion = useIntraLedgerConversion({ onSuccess: navigateToSuccess })
  const cardTopUp = useCardTopUp({ onSuccess: navigateToSuccess })
  const cardWithdrawal = useCardWithdrawal({ onSuccess: navigateToSuccess })

  const activeConversion = (() => {
    if (isSelfCustodial) return nonCustodialConversion
    if (isCardTopUp) return cardTopUp
    if (isCardWithdrawal) return cardWithdrawal
    return intraLedgerConversion
  })()
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

  const walletOf = (currency: WalletCurrency): WalletDescriptor<WalletCurrency> =>
    currency === WalletCurrency.Btc
      ? { id: btcWallet.id, currency: WalletCurrency.Btc }
      : { id: usdWallet.id, currency: WalletCurrency.Usd }
  const fromWallet = walletOf(fromCurrency)
  const toWallet = walletOf(toCurrency)

  const fromAmount = convertMoneyAmount(moneyAmount, fromCurrency)
  const toAmount = convertMoneyAmount(moneyAmount, toCurrency)

  const balanceLabels: Record<TransferBalance, string> = {
    [WalletCurrency.Btc]: LL.common.bitcoin(),
    [WalletCurrency.Usd]: LL.common.dollar(),
    [CARD]: LL.common.card(),
  }
  const fromWalletLabel = balanceLabels[fromBalance]
  const toWalletLabel = balanceLabels[toBalance]

  const fromWalletBalanceFormatted = formatMoneyAmount({ moneyAmount: fromAmount })
  const fromSatsFormatted =
    fromCurrency === WalletCurrency.Usd && displayCurrency === WalletCurrency.Usd
      ? null
      : moneyAmountToDisplayCurrencyString({
          moneyAmount: fromAmount,
          isApproximate: true,
        })

  const isToAmountApproximate = !isSameCurrency
  const toWalletBalanceFormatted = formatMoneyAmount({
    moneyAmount: toAmount,
    isApproximate: isToAmountApproximate,
  })
  const isToAlreadyInDisplayCurrency =
    toCurrency === WalletCurrency.Usd && displayCurrency === WalletCurrency.Usd
  const isToDisplayAmountShown = isToAmountApproximate && !isToAlreadyInDisplayCurrency
  const toSatsFormatted = isToDisplayAmountShown
    ? moneyAmountToDisplayCurrencyString({
        moneyAmount: toAmount,
        isApproximate: true,
      })
    : null

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
    if (isCardTopUp) {
      await cardTopUp.execute({ walletId: fromWallet.id, amountSats: toAmount.amount })
      return
    }
    if (isCardWithdrawal) {
      await cardWithdrawal.execute({ amountSats: fromAmount.amount })
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
              currency={fromBalance}
              containerSize="medium"
              containerStyle={pillWidthStyle}
              onLayout={onPillLayout(fromBalance)}
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
              <GaloyIcon name="arrow-down" color={colors.textDisabled} size={25} />
            </TouchableOpacity>
          </View>
          <View style={styles.toFieldContainer}>
            <CurrencyPill
              currency={toBalance}
              containerSize="medium"
              containerStyle={pillWidthStyle}
              onLayout={onPillLayout(toBalance)}
            />
            <View style={styles.walletSelectorBalanceContainer}>
              <Text style={styles.conversionInfoFieldValue}>
                {toWalletBalanceFormatted}
              </Text>
              {toSatsFormatted && (
                <Text style={styles.conversionInfoFieldConvertValue}>
                  {toSatsFormatted}
                </Text>
              )}
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
        {isToAmountApproximate && (
          <View style={styles.infoContainer}>
            <Text style={styles.conversionInfoFieldTitle}>
              {toCurrency === WalletCurrency.Btc
                ? LL.ConversionConfirmationScreen.infoBitcoin()
                : LL.ConversionConfirmationScreen.infoDollar()}
            </Text>
          </View>
        )}
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
    ...staticSurface(colors),
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
    color: colors.textPrimary,
  },
  conversionInfoFieldTitle: {
    color: colors.textSecondary,
    lineHeight: 25,
    fontFamily: fonts.regular,
  },
  conversionInfoFieldValue: {
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  conversionInfoFieldConvertValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.regular,
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
    backgroundColor: colors.neutral,
    height: 1,
    flex: 1,
  },
  switchButton: {
    position: "absolute",
    left: 100,
    height: 43,
    width: 43,
    borderRadius: 50,
    backgroundColor: colors.neutral,
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
    ...staticSurface(colors),
    borderRadius: 6,
    padding: 20,
    paddingVertical: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.textOnBackground,
  },
  sliderContainer: {
    padding: 20,
  },
}))
