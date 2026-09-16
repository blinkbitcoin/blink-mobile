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
import { fonts } from "@app/rne-theme/fonts"

export const PERCENTAGE_OPTIONS = [25, 50, 75, 100] as const
const DEFAULT_TEST_ID_PREFIX = "convert"

export type PercentageSelectorProps = {
  isLocked: boolean
  loadingPercent: number | null
  /** The active percentage, drawn as a pressed chip so the current selection stays visible
   *  after its amount settles (the migration lands here already on 100%). */
  selectedPercent?: number | null
  onSelect: (percentage: number) => void
  options?: Readonly<number[]>
  disabledOptions?: Readonly<number[]>
  testIdPrefix?: string
  containerStyle?: StyleProp<ViewStyle>
}

export const PercentageSelector: React.FC<PercentageSelectorProps> = ({
  isLocked,
  loadingPercent,
  selectedPercent,
  onSelect,
  options,
  disabledOptions,
  testIdPrefix = DEFAULT_TEST_ID_PREFIX,
  containerStyle,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const opts = useMemo(
    () => (options && options.length ? options : PERCENTAGE_OPTIONS),
    [options],
  )

  return (
    <View style={[styles.row, containerStyle]}>
      {opts.map((p) => {
        const loading = loadingPercent === p
        const isSelected = !loading && selectedPercent === p
        const isDisabled = isLocked || (disabledOptions?.includes(p) ?? false)
        return (
          <TouchableOpacity
            key={p}
            {...testProps(`${testIdPrefix}-${p}%`)}
            style={[
              styles.chip,
              isSelected && styles.chipSelected,
              isDisabled && styles.chipDisabled,
            ]}
            disabled={isDisabled}
            onPress={() => onSelect(p)}
            accessibilityLabel={testIdPrefix}
            accessibilityState={{ selected: isSelected, disabled: isDisabled }}
          >
            {/* The label keeps its space under the spinner so the chip doesn't resize. */}
            <Text
              style={[
                styles.chipText,
                isSelected && styles.chipTextSelected,
                loading && styles.chipTextHidden,
              ]}
            >
              {p}%
            </Text>
            {loading && (
              <ActivityIndicator style={styles.spinner} color={colors.primary} />
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
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  chip: {
    backgroundColor: colors.grey5,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  chipTextHidden: {
    opacity: 0,
  },
  spinner: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  chipTextSelected: {
    color: colors.white,
  },
}))
