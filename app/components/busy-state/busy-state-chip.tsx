import React from "react"
import { View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { CHIP_GLYPH_SIZE, CHIP_SIZE } from "./config"

export type BusyChip = {
  /** Rendered centred in a `CHIP_GLYPH_SIZE` box. Give it that size. */
  icon: React.ReactNode
  /** Chip background. Defaults to `colors.grey5`. */
  backgroundColor?: string
}

/**
 * The round 52×52 surface a busy-state glyph sits on.
 *
 * Deliberately has no shadow and no `elevation`: the entrance depends on the two
 * chips' sibling order to read as one emerging from behind the other, and on
 * Android any `elevation` would override that order.
 */
export const BusyStateChip: React.FC<BusyChip> = ({ icon, backgroundColor }) => {
  const styles = useStyles()

  return (
    <View style={[styles.chip, backgroundColor ? { backgroundColor } : undefined]}>
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
