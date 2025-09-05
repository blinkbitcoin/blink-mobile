import React from "react"
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native"
import { makeStyles, useTheme, Icon } from "@rneui/themed"

import { testProps } from "@app/utils/testProps"

type PayoutSpeedSelectorProps = {
  label?: string
  estimate?: string
  loading?: boolean
  readOnly?: boolean
  onPress?: () => void
}

export const PayoutSpeedSelector: React.FC<PayoutSpeedSelectorProps> = ({
  onPress,
  label,
  estimate,
  loading,
  readOnly = false,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <TouchableOpacity
      {...testProps("fee-input")}
      style={[styles.fieldBackground, loading && styles.disabled]}
      disabled={loading || readOnly}
      onPress={readOnly ? undefined : onPress}
      activeOpacity={readOnly ? 1 : 0.2}
    >
      <View style={styles.feeContainer}>
        <Text style={styles.feePrimary} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
        {estimate ? (
          <Text style={styles.feeSecondary} numberOfLines={1} ellipsizeMode="tail">
            ~ {estimate}
          </Text>
        ) : null}
      </View>

      {!readOnly && (
        <View style={styles.iconContainer}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.black} />
          ) : (
            <Icon name="chevron-down" type="ionicon" size={24} color={colors.primary} />
          )}
        </View>
      )}
    </TouchableOpacity>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  fieldBackground: {
    flexDirection: "row",
    borderStyle: "solid",
    overflow: "hidden",
    backgroundColor: colors.grey5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    minHeight: 60,
  },
  disabled: {
    opacity: 0.8,
    backgroundColor: colors.grey4,
  },
  feeContainer: {
    flex: 1,
    justifyContent: "center",
  },
  feePrimary: {
    color: colors.black,
    fontSize: 16,
  },
  feeSecondary: {
    color: colors.grey1,
    marginTop: 4,
    fontSize: 12,
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
}))
