import * as React from "react"
import ContentLoader, { Rect } from "react-content-loader/native"
import { TouchableOpacity, View, Text } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { StatusPill, type StatusPillVariant } from "@app/components/status-pill"
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

export type StatusBadge = {
  label: string
  status: StatusPillVariant
}

type Props = {
  loading: boolean
  formattedBalance?: string
  statusBadge?: StatusBadge
}

export const BalanceHeader: React.FC<Props> = ({
  loading,
  formattedBalance,
  statusBadge,
}) => {
  const styles = useStyles()

  const { hideAmount, switchMemoryHideAmount } = useHideAmount()

  const showBadge = Boolean(statusBadge) && !loading && !hideAmount

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
          <View style={styles.amountWrapper}>
            {showBadge && statusBadge ? (
              <StatusPill
                label={statusBadge.label}
                status={statusBadge.status}
                ghost
                style={styles.statusPillGhost}
              />
            ) : null}
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
            {showBadge && statusBadge ? (
              <StatusPill
                label={statusBadge.label}
                status={statusBadge.status}
                testID="balance-status-badge"
                style={styles.statusPill}
              />
            ) : null}
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
  },
  amountWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    alignSelf: "center",
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
  statusPill: {
    marginLeft: 6,
    marginTop: 2,
  },
  statusPillGhost: {
    marginRight: 6,
    marginTop: 2,
  },
}))
