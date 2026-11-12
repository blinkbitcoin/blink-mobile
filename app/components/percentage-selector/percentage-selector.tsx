import React, { useMemo } from "react"
import { StyleProp, View, ViewStyle } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { Chip } from "@app/components/atomic/chip"

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
      {opts.map((p) => (
        <Chip
          key={p}
          label={formatLabel(p)}
          testID={`${testIdPrefix}-${p}%`}
          loading={loadingPercent === p}
          selected={selectedPercent === p}
          disabled={isLocked || (disabledOptions?.includes(p) ?? false)}
          onPress={() => onSelect(p)}
        />
      ))}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
}))
