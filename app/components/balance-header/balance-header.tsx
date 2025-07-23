import * as React from "react"
import ContentLoader, { Rect } from "react-content-loader/native"
import { TouchableOpacity, View } from "react-native"

import { gql } from "@apollo/client"
import { useBalanceHeaderQuery } from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { usePriceConversion } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import {
  DisplayCurrency,
  addMoneyAmounts,
  toBtcMoneyAmount,
  toUsdMoneyAmount,
} from "@app/types/amounts"
import { testProps } from "@app/utils/testProps"
import { makeStyles, Text } from "@rn-vui/themed"

const Loader = () => {
  const styles = useStyles()
  return (
    <ContentLoader
      height={40}
      width={100}
      speed={1.2}
      backgroundColor={styles.loaderBackground.color}
      foregroundColor={styles.loaderForefound.color}
    >
      <Rect x="0" y="0" rx="4" ry="4" width="100" height="40" />
    </ContentLoader>
  )
}

gql`
  query balanceHeader {
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
}

export const BalanceHeader: React.FC<Props> = ({ loading }) => {
  const styles = useStyles()

  const { hideAmount, switchMemoryHideAmount } = useHideAmount()

  const isAuthed = useIsAuthed()
  const { formatMoneyAmount } = useDisplayCurrency()
  const { convertMoneyAmount } = usePriceConversion()

  // TODO: use suspense for this component with the apollo suspense hook (in beta)
  // so there is no need to pass loading from parent?
  const { data } = useBalanceHeaderQuery({ skip: !isAuthed })

  // TODO: check that there are 2 wallets.
  // otherwise fail (account with more/less 2 wallets will not be working with the current mobile app)
  // some tests accounts have only 1 wallet

  let balanceInDisplayCurrency = "$0.00"

  if (isAuthed) {
    const btcWallet = getBtcWallet(data?.me?.defaultAccount?.wallets)
    const usdWallet = getUsdWallet(data?.me?.defaultAccount?.wallets)

    const usdWalletBalance = toUsdMoneyAmount(usdWallet?.balance)

    const btcWalletBalance = toBtcMoneyAmount(btcWallet?.balance)

    const btcBalanceInDisplayCurrency =
      convertMoneyAmount && convertMoneyAmount(btcWalletBalance, DisplayCurrency)

    const usdBalanceInDisplayCurrency =
      convertMoneyAmount && convertMoneyAmount(usdWalletBalance, DisplayCurrency)

    if (usdBalanceInDisplayCurrency && btcBalanceInDisplayCurrency) {
      balanceInDisplayCurrency = formatMoneyAmount({
        moneyAmount: addMoneyAmounts({
          a: usdBalanceInDisplayCurrency,
          b: btcBalanceInDisplayCurrency,
        }),
      })
    }
  }

  return (
    <View {...testProps("balance-header")} style={styles.balanceHeaderContainer}>
      {hideAmount ? (
        <TouchableOpacity
          onPress={switchMemoryHideAmount}
          style={styles.hiddenBalanceTouchableOpacity}
        >
          <Text style={styles.balanceHiddenText}>****</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.balancesContainer}>
          <TouchableOpacity onPress={switchMemoryHideAmount}>
            <View style={styles.marginBottom}>
              {loading ? (
                <Loader />
              ) : (
                <Text style={styles.primaryBalanceText}>{balanceInDisplayCurrency}</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  balanceHeaderContainer: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
  },
  balancesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  marginBottom: {
    marginBottom: 4,
  },
  hiddenBalanceTouchableOpacity: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
  },
  primaryBalanceText: {
    fontSize: 32,
  },
  loaderBackground: {
    color: colors.loaderBackground,
  },
  loaderForefound: {
    color: colors.loaderForeground,
  },
  balanceHiddenText: {
    fontSize: 32,
    fontWeight: "bold",
  },
}))
