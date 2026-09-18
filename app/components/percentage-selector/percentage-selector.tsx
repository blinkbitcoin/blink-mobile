import React, { useMemo } from "react"
import { StyleProp, View, ViewStyle } from "react-native"
import { makeStyles } from "@rn-vui/themed"

import { Chip } from "@app/components/atomic/chip"

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
  const styles = useStyles()
  const opts = useMemo(
    () => (options && options.length ? options : PERCENTAGE_OPTIONS),
    [options],
  )

  return (
    <View style={[styles.row, containerStyle]}>
      {opts.map((p) => (
        <Chip
          key={p}
          label={`${p}%`}
          testID={`${testIdPrefix}-${p}%`}
          accessibilityLabel={testIdPrefix}
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
