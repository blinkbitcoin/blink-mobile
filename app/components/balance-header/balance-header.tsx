import * as React from "react"
import ContentLoader, { Rect } from "react-content-loader/native"
import { TouchableOpacity, View, Text } from "react-native"

import { makeStyles } from "@rn-vui/themed"

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
      viewBox="0 0 100 40"
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
        <TouchableOpacity onPress={switchMemoryHideAmount}>
          <Text style={styles.balanceHiddenText}>****</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={switchMemoryHideAmount}>
          <View>
            {loading ? (
              <Loader />
            ) : (
              <Text
                style={styles.primaryBalanceText}
                allowFontScaling
                adjustsFontSizeToFit
              >
                {formattedBalance}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  balanceHeaderContainer: {
    alignItems: "center",
    textAlign: "center",
    justifyContent: "flex-start",
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    height: 60,
    maxHeight: 60,
  },
  primaryBalanceText: {
    fontSize: 32,
    color: colors.black,
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
    color: colors.black,
  },
}))
