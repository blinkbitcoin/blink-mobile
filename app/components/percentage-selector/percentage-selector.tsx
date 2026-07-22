import React, { useMemo } from "react"
import {
  ActivityIndicator,
  StyleProp,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { testProps } from "@app/utils/testProps"

const DEFAULT_OPTIONS = [25, 50, 75, 100] as const
const DEFAULT_TEST_ID_PREFIX = "convert"

export type PercentageSelectorProps = {
  isLocked: boolean
  loadingPercent: number | null
  /** The active percentage, drawn as a pressed chip so the current selection stays visible
   *  after its amount settles (the migration lands here already on 100%). */
  selectedPercent?: number | null
  onSelect: (percentage: number) => void
  options?: Readonly<number[]>
  testIdPrefix?: string
  containerStyle?: StyleProp<ViewStyle>
}

export const PercentageSelector: React.FC<PercentageSelectorProps> = ({
  isLocked,
  loadingPercent,
  selectedPercent,
  onSelect,
  options,
  testIdPrefix = DEFAULT_TEST_ID_PREFIX,
  containerStyle,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const opts = useMemo(
    () => (options && options.length ? options : DEFAULT_OPTIONS),
    [options],
  )

  return (
    <View style={[styles.row, containerStyle]}>
      {opts.map((p) => {
        const loading = loadingPercent === p
        const isSelected = !loading && selectedPercent === p
        return (
          <TouchableOpacity
            key={p}
            {...testProps(`${testIdPrefix}-${p}%`)}
            style={[
              styles.chip,
              isSelected && styles.chipSelected,
              isLocked && styles.chipDisabled,
            ]}
            disabled={isLocked}
            onPress={() => onSelect(p)}
            accessibilityLabel={testIdPrefix}
            accessibilityState={{ selected: isSelected }}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {p}%
              </Text>
            )}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
  },
  chip: {
    backgroundColor: colors.grey5,
    borderRadius: 100,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 64,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    color: colors.primary,
    fontWeight: "bold",
  },
  chipTextSelected: {
    color: colors.white,
  },
}))
