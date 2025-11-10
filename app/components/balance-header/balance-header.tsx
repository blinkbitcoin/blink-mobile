import * as React from "react"
import ContentLoader, { Rect } from "react-content-loader/native"
import { TouchableOpacity, View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { useHideAmount } from "@app/graphql/hide-amount-context"
import { testProps } from "@app/utils/testProps"

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

type Props = {
  loading: boolean
  formattedBalance?: string
}

export const BalanceHeader: React.FC<Props> = ({ loading, formattedBalance }) => {
  const styles = useStyles()

  const { hideAmount, switchMemoryHideAmount } = useHideAmount()

  // TODO: use suspense for this component with the apollo suspense hook (in beta)
  // so there is no need to pass loading from parent?
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
                <Text style={styles.primaryBalanceText}>{formattedBalance}</Text>
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
