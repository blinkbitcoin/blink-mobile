import React, { useState } from "react"
import ContentLoader, { Rect } from "react-content-loader/native"
import { Pressable, View } from "react-native"

import { gql } from "@apollo/client"
import { DisabledFeature } from "@app/components/disabled-feature"
import { useRestrictedRegion } from "@app/components/restricted-region"
import { useWalletOverviewScreenQuery, WalletCurrency } from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet, WalletBalance } from "@app/graphql/wallets-utils"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useDollarBalanceGate } from "@app/hooks/use-dollar-balance-restricted"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { HiddenBalancePlaceholder } from "@app/components/hidden-balance-placeholder/hidden-balance-placeholder"
import { GaloyIcon } from "../atomic/galoy-icon"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { NotificationBadge } from "@app/components/notification-badge"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { CurrencyPill, useEqualPillWidth } from "../atomic/currency-pill"

const CARD_NUMBER_MASK = "••••"

const Loader = () => {
  const styles = useStyles()
  return (
    <View style={styles.loaderContainer}>
      <ContentLoader
        height={45}
        width={"60%"}
        speed={1.2}
        backgroundColor={styles.loaderBackground.color}
        foregroundColor={styles.loaderForefound.color}
      >
        <Rect x="0" y="0" rx="4" ry="4" width="100%" height="100%" />
      </ContentLoader>
    </View>
  )
}

gql`
  query walletOverviewScreen {
    me {
      id
      defaultAccount {
        id
        wallets {
          id
          balance
          walletCurrency
        }
      }
    }
  }
`

type Props = {
  loading: boolean
  setIsStablesatModalVisible: (value: boolean) => void
  onGatedTap?: () => void
  wallets?: readonly WalletBalance[]
  hasCard?: boolean
  cardLastFour?: string | null
  showBtcNotification?: boolean
  showUsdNotification?: boolean
}

const WalletOverview: React.FC<Props> = ({
  loading,
  setIsStablesatModalVisible,
  onGatedTap,
  wallets,
  hasCard = false,
  cardLastFour,
  showBtcNotification = false,
  showUsdNotification = false,
}) => {
  const { isGated: isDollarBalanceGated, isRegionPending } = useDollarBalanceGate()
  const { isRestrictedRegion } = useRestrictedRegion()
  const isDollarRowUnavailable = isDollarBalanceGated || isRestrictedRegion
  const { isAnonMode } = useSelfCustodialAccountMode()
  const { hideAmount, toggleHideAmount } = useHideAmount()

  const { LL } = useI18nContext()
  const unavailableLabel = isAnonMode
    ? LL.StablesatsRestriction.anonModeWalletLabel()
    : LL.StablesatsRestriction.walletLabel()
  const isAuthed = useIsAuthed()
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { formatMoneyAmount, displayCurrency, moneyAmountToDisplayCurrencyString } =
    useDisplayCurrency()

  let btcInDisplayCurrencyFormatted: string | undefined = "$0.00"
  let usdInDisplayCurrencyFormatted: string | undefined = "$0.00"
  let btcInUnderlyingCurrency: string | undefined = "0 sat"
  let usdInUnderlyingCurrency: string | undefined = undefined

  const hasWallets = wallets && wallets.length > 0
  const { data } = useWalletOverviewScreenQuery({ skip: !isAuthed || hasWallets })
  const resolvedWallets = hasWallets ? wallets : data?.me?.defaultAccount?.wallets

  const hasUsdBalance = (getUsdWallet(resolvedWallets)?.balance ?? 0) > 0
  /** A gated balance still shows its amount (the row stays disabled); the label only
   *  stands in when there is nothing to show. */
  const showsUnavailableLabel = isDollarRowUnavailable && !hasUsdBalance

  if (isAuthed || hasWallets) {
    const btcWallet = getBtcWallet(resolvedWallets)
    const usdWallet = getUsdWallet(resolvedWallets)

    const btcWalletBalance = toBtcMoneyAmount(btcWallet?.balance ?? NaN)

    const usdWalletBalance = toUsdMoneyAmount(usdWallet?.balance ?? NaN)

    btcInDisplayCurrencyFormatted = moneyAmountToDisplayCurrencyString({
      moneyAmount: btcWalletBalance,
      isApproximate: true,
    })

    usdInDisplayCurrencyFormatted = moneyAmountToDisplayCurrencyString({
      moneyAmount: usdWalletBalance,
      isApproximate: displayCurrency !== WalletCurrency.Usd,
    })

    btcInUnderlyingCurrency = formatMoneyAmount({ moneyAmount: btcWalletBalance })

    if (displayCurrency !== WalletCurrency.Usd) {
      usdInUnderlyingCurrency = formatMoneyAmount({ moneyAmount: usdWalletBalance })
    }
  }

  const openTransactionHistory = (currencyFilter: WalletCurrency) => {
    if (!resolvedWallets || resolvedWallets.length === 0) return
    navigation.navigate("transactionHistory", {
      wallets: resolvedWallets,
      currencyFilter,
    })
  }

  const [pressedBtc, setPressedBtc] = useState(false)
  const [pressedUsd, setPressedUsd] = useState(false)
  const { widthStyle: pillWidthStyle, onPillLayout } = useEqualPillWidth()

  const showCardLastFour = Boolean(cardLastFour) && !hideAmount
  const maskedCardNumber = showCardLastFour
    ? `${CARD_NUMBER_MASK} ${cardLastFour}`
    : CARD_NUMBER_MASK

  /** The dollar row rides the same loader while the region resolves, and stays inert
   *  meanwhile: reading the unresolved region as unrestricted is what showed a restricted
   *  user their balance at launch. The explanation waits too, since it would be wrong for
   *  a user who turns out to be unrestricted. */
  const isDollarBalanceLoading = loading || isRegionPending
  const isDollarRowInert = isDollarRowUnavailable || isRegionPending
  const onDollarGatedPress = isRegionPending ? undefined : onGatedTap
  /** Carries the reason, since gating the row hides the label that states it. */
  const dollarRowAccessibilityLabel = isDollarRowUnavailable
    ? `${LL.common.dollar()}, ${unavailableLabel}`
    : LL.common.dollar()

  return (
    <View style={styles.container}>
      <View style={styles.myAccounts}>
        <Text type="p1" bold {...testProps(LL.HomeScreen.myAccounts())}>
          {LL.HomeScreen.myAccounts()}
        </Text>
        <Pressable onPress={toggleHideAmount}>
          <GaloyIcon name={hideAmount ? "eye-slash" : "eye"} size={24} />
        </Pressable>
      </View>

      <View style={[styles.separator, styles.titleSeparator]} />

      <Pressable
        onPressIn={() => setPressedBtc(true)}
        onPressOut={() => setPressedBtc(false)}
        onPress={() => {
          openTransactionHistory(WalletCurrency.Btc)
        }}
      >
        <View style={styles.displayTextView}>
          <View style={styles.currency}>
            <View style={styles.bubbleWrapper} pointerEvents="box-none">
              <View style={pressedBtc && styles.pressedOpacity}>
                <CurrencyPill
                  currency={WalletCurrency.Btc}
                  containerSize="medium"
                  containerStyle={pillWidthStyle}
                  onLayout={onPillLayout(WalletCurrency.Btc)}
                />
              </View>
              <NotificationBadge visible={showBtcNotification} />
            </View>
          </View>
          {loading ? (
            <Loader />
          ) : hideAmount ? (
            <HiddenBalancePlaceholder size="small" />
          ) : (
            <View style={[styles.hideableArea, pressedBtc && styles.pressedOpacity]}>
              <Text
                type="p1"
                bold
                style={styles.boldBalance}
                {...testProps("bitcoin-balance")}
              >
                {btcInUnderlyingCurrency}
              </Text>
              <Text type="p3">{btcInDisplayCurrencyFormatted}</Text>
            </View>
          )}
        </View>
      </Pressable>

      <View style={styles.separator} />

      <DisabledFeature
        disabled={isDollarRowInert}
        onDisabledPress={onDollarGatedPress}
        accessibilityLabel={dollarRowAccessibilityLabel}
      >
        <Pressable
          onPressIn={() => setPressedUsd(true)}
          onPressOut={() => setPressedUsd(false)}
          onPress={() => {
            openTransactionHistory(WalletCurrency.Usd)
          }}
        >
          <View style={styles.displayTextView}>
            <View style={styles.currency}>
              <View style={styles.bubbleWrapper} pointerEvents="box-none">
                <View style={pressedUsd && styles.pressedOpacity}>
                  <CurrencyPill
                    currency={WalletCurrency.Usd}
                    containerSize="medium"
                    containerStyle={pillWidthStyle}
                    onLayout={onPillLayout(WalletCurrency.Usd)}
                  />
                </View>
                <NotificationBadge visible={showUsdNotification} />
              </View>
              <Pressable onPress={() => setIsStablesatModalVisible(true)}>
                <GaloyIcon color={colors.grey1} name="question" size={18} />
              </Pressable>
            </View>
            {isDollarBalanceLoading ? (
              <Loader />
            ) : showsUnavailableLabel ? (
              <View style={[styles.hideableArea, styles.restrictionLabel]}>
                <Text type="p2" style={styles.restrictionLabelText}>
                  {unavailableLabel}
                </Text>
              </View>
            ) : (
              <View style={[styles.hideableArea, pressedUsd && styles.pressedOpacity]}>
                {!hideAmount && (
                  <>
                    {usdInUnderlyingCurrency ? (
                      <Text type="p1" bold style={styles.boldBalance}>
                        {usdInUnderlyingCurrency}
                      </Text>
                    ) : null}
                    <Text
                      {...testProps("stablesats-balance")}
                      type={usdInUnderlyingCurrency ? "p3" : "p1"}
                      bold={!usdInUnderlyingCurrency}
                      style={!usdInUnderlyingCurrency && styles.boldBalance}
                    >
                      {usdInDisplayCurrencyFormatted}
                    </Text>
                  </>
                )}
                {hideAmount && <HiddenBalancePlaceholder size="small" />}
              </View>
            )}
          </View>
        </Pressable>
      </DisabledFeature>

      {hasCard && (
        <>
          <View style={styles.separator} />
          <Pressable onPress={() => navigation.navigate("cardDashboardScreen")}>
            <View style={styles.displayTextView}>
              <View style={styles.currency}>
                <CurrencyPill
                  currency={WalletCurrency.Usd}
                  label={LL.common.card()}
                  highlighted={false}
                  containerSize="medium"
                  containerStyle={[pillWidthStyle, styles.cardPillBackground]}
                />
              </View>
              <Text type="p1" bold>
                {maskedCardNumber}
              </Text>
            </View>
          </Pressable>
        </>
      )}
    </View>
  )
}

export default WalletOverview

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.grey5,
    display: "flex",
    flexDirection: "column",
    borderRadius: 12,
    padding: 12,
    paddingBottom: 5,
  },
  loaderBackground: {
    color: colors.loaderBackground,
  },
  loaderForefound: {
    color: colors.loaderForeground,
  },
  myAccounts: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  displayTextView: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 45,
    marginVertical: 4,
    marginTop: 5,
  },
  separator: {
    height: 1,
    backgroundColor: colors.grey4,
    marginVertical: 2,
  },
  titleSeparator: {
    marginTop: 12,
  },
  currency: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  bubbleWrapper: {
    position: "relative",
  },
  hideableArea: {
    alignItems: "flex-end",
  },
  restrictionLabel: {
    flex: 1,
    marginLeft: 8,
  },
  restrictionLabelText: {
    textAlign: "right",
  },
  boldBalance: {
    fontFamily: "SourceSansPro-Bold",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    height: 45,
    marginTop: 5,
  },
  pressedOpacity: { opacity: 0.7 },
  cardPillBackground: {
    backgroundColor: colors._cardPill,
  },
}))
