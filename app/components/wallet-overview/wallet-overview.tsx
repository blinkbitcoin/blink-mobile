import React from "react"
import ContentLoader, { Rect } from "react-content-loader/native"
import { Pressable, StyleProp, View, ViewStyle } from "react-native"

import { gql } from "@apollo/client"
import { useWalletOverviewScreenQuery, WalletCurrency } from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet, WalletBalance } from "@app/graphql/wallets-utils"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "../atomic/galoy-icon"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { GaloyCurrencyBubbleText } from "../atomic/galoy-currency-bubble-text"

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
  wallets?: readonly WalletBalance[]
}

const WalletOverview: React.FC<Props> = ({
  loading,
  setIsStablesatModalVisible,
  wallets,
}) => {
  const { hideAmount, switchMemoryHideAmount } = useHideAmount()

  const { LL } = useI18nContext()
  const isAuthed = useIsAuthed()
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { data } = useWalletOverviewScreenQuery({ skip: !isAuthed })
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { formatMoneyAmount, displayCurrency, moneyAmountToDisplayCurrencyString } =
    useDisplayCurrency()

  let btcInDisplayCurrencyFormatted: string | undefined = "$0.00"
  let usdInDisplayCurrencyFormatted: string | undefined = "$0.00"
  let btcInUnderlyingCurrency: string | undefined = "0 sat"
  let usdInUnderlyingCurrency: string | undefined = undefined

  if (isAuthed) {
    const btcWallet = getBtcWallet(data?.me?.defaultAccount?.wallets)
    const usdWallet = getUsdWallet(data?.me?.defaultAccount?.wallets)

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

  const openTransactionHistory = (currencyFilter: WalletCurrency) =>
    wallets && navigation.navigate("transactionHistory", { wallets, currencyFilter })

  const pressableStyle = ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => {
    if (pressed) {
      return [styles.interactiveOpacity]
    }
    return []
  }
  return (
    <View style={styles.container}>
      <View style={styles.myAccounts}>
        <Text type="p1" bold {...testProps(LL.HomeScreen.myAccounts())}>
          {LL.HomeScreen.myAccounts()}
        </Text>
        <Pressable onPress={switchMemoryHideAmount}>
          <GaloyIcon name={hideAmount ? "eye-slash" : "eye"} size={24} />
        </Pressable>
      </View>
      <View style={[styles.separator, styles.titleSeparator]}></View>
      <View style={styles.displayTextView}>
        <View style={styles.currency}>
          <Pressable
            style={pressableStyle}
            onPress={() => openTransactionHistory(WalletCurrency.Btc)}
          >
            <GaloyCurrencyBubbleText
              currency={WalletCurrency.Btc}
              textSize="p2"
              containerSize="medium"
            />
          </Pressable>
        </View>
        {loading ? (
          <Loader />
        ) : hideAmount ? (
          <Text>****</Text>
        ) : (
          <View style={styles.hideableArea}>
            <Text type="p1" bold {...testProps("bitcoin-balance")}>
              {btcInUnderlyingCurrency}
            </Text>
            <Text type="p3">{btcInDisplayCurrencyFormatted}</Text>
          </View>
        )}
      </View>
      <View style={styles.separator}></View>
      <View style={styles.displayTextView}>
        <View style={styles.currency}>
          <Pressable
            style={pressableStyle}
            onPress={() => openTransactionHistory(WalletCurrency.Usd)}
          >
            <GaloyCurrencyBubbleText
              currency={WalletCurrency.Usd}
              textSize="p2"
              containerSize="medium"
            />
          </Pressable>
          <Pressable onPress={() => setIsStablesatModalVisible(true)}>
            <GaloyIcon color={colors.grey1} name="question" size={18} />
          </Pressable>
        </View>
        {loading ? (
          <Loader />
        ) : (
          <View style={styles.hideableArea}>
            {!hideAmount && (
              <>
                {usdInUnderlyingCurrency ? (
                  <Text type="p1" bold>
                    {usdInUnderlyingCurrency}
                  </Text>
                ) : null}
                <Text
                  {...testProps("stablesats-balance")}
                  type={usdInUnderlyingCurrency ? "p3" : "p1"}
                  bold={!usdInUnderlyingCurrency}
                >
                  {usdInDisplayCurrencyFormatted}
                </Text>
              </>
            )}
            {hideAmount && <Text>****</Text>}
          </View>
        )}
      </View>
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
    height: 45,
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
  hideableArea: {
    alignItems: "flex-end",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    height: 45,
    marginTop: 5,
  },
  interactiveOpacity: {
    opacity: 0.5,
  },
}))
