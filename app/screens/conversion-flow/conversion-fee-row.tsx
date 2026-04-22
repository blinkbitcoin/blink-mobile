import React from "react"
import { ActivityIndicator, View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"

type Props = {
  feeText: string
  adjustmentText: string | null
  isLoading: boolean
  hasError: boolean
}

export const ConversionFeeRow: React.FC<Props> = ({
  feeText,
  adjustmentText,
  isLoading,
  hasError,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const valueText = hasError ? LL.ConversionConfirmationScreen.feeError() : feeText

  return (
    <View style={styles.card}>
      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.row}>
          <Text style={styles.label}>{LL.ConversionConfirmationScreen.feeLabel()}</Text>
          <Text style={[styles.value, hasError && styles.errorValue]}>{valueText}</Text>
        </View>
      )}
      {adjustmentText ? (
        <Text type="p2" style={styles.adjustment}>
          {adjustmentText}
        </Text>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: colors.grey5,
    borderRadius: 13,
    padding: 20,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: colors.grey2,
    fontSize: 14,
    fontWeight: "600",
  },
  value: {
    color: colors.grey1,
    fontSize: 14,
    fontWeight: "700",
  },
  errorValue: {
    color: colors.error,
  },
  adjustment: {
    color: colors.warning,
    fontSize: 12,
  },
}))
