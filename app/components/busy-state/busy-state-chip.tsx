import React from "react"
import { View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { CHIP_GLYPH_SIZE, CHIP_SIZE } from "./config"

export type BusyStateChipProps = {
  /** Rendered centred in a `CHIP_GLYPH_SIZE` box. Give it that size. */
  icon: React.ReactNode
}

/**
 * The round 52×52 `colors.grey5` surface a busy-state glyph sits on.
 *
 * Deliberately has no shadow and no `elevation`. Stacking is set by the parent
 * with `zIndex`, and on Android an `elevation` here would override it.
 */
export const BusyStateChip: React.FC<BusyStateChipProps> = ({ icon }) => {
  const styles = useStyles()

  return (
    <View style={styles.chip}>
      <View style={styles.glyph}>{icon}</View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  chip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: CHIP_SIZE / 2,
    backgroundColor: colors.grey5,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    width: CHIP_GLYPH_SIZE,
    height: CHIP_GLYPH_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
}))
