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

/** Generic over the option type so a caller with a closed set of values, such as day counts,
 *  gets that set back in onSelect instead of any number. */
export type PercentageSelectorProps<T extends number = number> = {
  isLocked: boolean
  loadingPercent: number | null
  /** The active percentage, drawn as a pressed chip so the current selection stays visible
   *  after its amount settles (the migration lands here already on 100%). */
  selectedPercent?: T | null
  onSelect: (percentage: T) => void
  options?: Readonly<T[]>
  disabledOptions?: Readonly<number[]>
  testIdPrefix?: string
  containerStyle?: StyleProp<ViewStyle>
  /** For chips that aren't percentages, such as day counts. */
  formatLabel?: (option: T) => string
}

export const PercentageSelector = <T extends number = number>({
  isLocked,
  loadingPercent,
  selectedPercent,
  onSelect,
  options,
  disabledOptions,
  testIdPrefix = DEFAULT_TEST_ID_PREFIX,
  containerStyle,
  formatLabel = (option) => `${option}%`,
}: PercentageSelectorProps<T>) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  // the default list only applies when options is omitted, where T is plain number
  const opts = useMemo(
    () =>
      options && options.length
        ? options
        : (PERCENTAGE_OPTIONS as unknown as Readonly<T[]>),
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
            accessibilityRole="button"
            // after testProps, which would otherwise read the test ID out to screen readers
            accessibilityLabel={formatLabel(p)}
            accessibilityState={{
              selected: isSelected,
              disabled: isDisabled,
              busy: loading,
            }}
          >
            {/* The label keeps its space under the spinner so the chip doesn't resize. */}
            <Text
              style={[
                styles.chipText,
                isSelected && styles.chipTextSelected,
                loading && styles.chipTextHidden,
              ]}
            >
              {formatLabel(p)}
            </Text>
            {loading && (
              <ActivityIndicator style={styles.spinner} color={colors.accent} />
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
    backgroundColor: colors.surfaceInteractive,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipSelected: {
    backgroundColor: colors.accent,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    color: colors.accent,
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
    color: colors.textOnAccent,
  },
}))
