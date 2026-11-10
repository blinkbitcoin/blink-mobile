import { StyleSheet } from "react-native"
import type { ReactTestInstance } from "react-test-renderer"
import { getAnimatedStyle } from "react-native-reanimated"
import { waitFor } from "@testing-library/react-native"

import { BOTTOM_OVERHANG } from "@app/components/bottom-sheet"

/**
 * The height a sheet's offsets are expressed in, not the one it is drawn at:
 * it is painted `BOTTOM_OVERHANG` taller so its antialiased bottom edge falls
 * below the screen, and the animation knows nothing about that pixel.
 */
export const animatedHeightOf = (sheet: ReactTestInstance) =>
  (StyleSheet.flatten(sheet.props.style).height as number) - BOTTOM_OVERHANG

/**
 * Where a sheet is right now. A spring is never exactly at rest, so anything
 * asserted against this wants a pixel of slack rather than an equality.
 */
export const translateYOf = (sheet: ReactTestInstance) =>
  (getAnimatedStyle(sheet).transform as [{ translateY: number }])[0].translateY

/**
 * Where a sheet comes to rest. A sample taken mid-spring can sit a hair past a
 * threshold on its way through, so this waits until two samples a poll apart
 * agree — the spring has finished, not just passed by.
 */
export const settledTranslateYOf = async (sheet: ReactTestInstance) => {
  let last = Number.NaN
  await waitFor(() => {
    const now = translateYOf(sheet)
    const isStill = now === last
    last = now
    expect(isStill).toBe(true)
  })
  return last
}
