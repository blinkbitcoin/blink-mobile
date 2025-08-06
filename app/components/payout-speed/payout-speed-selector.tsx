import React from "react"
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native"
import { makeStyles, useTheme, Icon } from "@rneui/themed"

import { testProps } from "@app/utils/testProps"

type PayoutSpeedSelectorProps = {
  value?: string
  loading?: boolean
  readOnly?: boolean
  onPress?: () => void
}

export const PayoutSpeedSelector: React.FC<PayoutSpeedSelectorProps> = ({
  onPress,
  value,
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
        <View style={styles.feeInline}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.black} />
          ) : (
            <Text style={styles.feeText}>{value}</Text>
          )}
        </View>
      </View>

      {!readOnly && (
        <View style={styles.iconContainer}>
          <Icon name="chevron-down" type="ionicon" size={24} color={colors.black} />
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
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 60,
  },
  disabled: {
    opacity: 0.8,
    backgroundColor: colors.grey4,
  },
  feeInline: {
    flexDirection: "row",
    alignItems: "center",
  },
  feeContainer: {
    flex: 1,
    justifyContent: "center",
  },
  feeText: {
    color: colors.black,
    fontSize: 16,
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 20,
  },
}))
