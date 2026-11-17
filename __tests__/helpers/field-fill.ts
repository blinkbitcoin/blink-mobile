import { StyleProp, StyleSheet, ViewStyle } from "react-native"
import type { ReactTestInstance } from "react-test-renderer"

import { light } from "@app/rne-theme/colors"

/** The two fills an auth field shows, from the light palette the screen tests render with.
 *  They differ, so a field stuck in either state fails. */
export const RESTING_FILL = light.surfaceInteractive
export const FOCUSED_FILL = light.surfaceFocused

export const flatStyle = (style: unknown): ViewStyle =>
  StyleSheet.flatten(style as StyleProp<ViewStyle>) ?? {}

/** The style rendered on the box around a text field: the nearest View above it. For an
 *  rn-vui `Input` that is its input container, after the library's own defaults (a 1px
 *  bottom border among them) are merged under the screen's style, so a dropped override
 *  shows here and not in the prop the screen passes. */
export const renderedBox = (field: ReactTestInstance): ViewStyle => {
  let node = field.parent
  while (node && String(node.type) !== "View") node = node.parent
  return flatStyle(node?.props.style)
}

type FocusFill = {
  /** True for a field that autofocuses: its first frame must already show the focused fill. */
  startsFocused: boolean
  /** Every surface that must show the field's fill: the field, and the country picker on the
   *  phone screens. Read again after each event. */
  surfaces: () => ViewStyle[]
  focus: () => void
  blur: () => void
}

/** The field pattern: the fill alone follows focus. No border in either state, and nothing
 *  else changes, so neither the box nor the text moves. */
export const expectFocusFill = ({ startsFocused, surfaces, focus, blur }: FocusFill) => {
  expect(RESTING_FILL).not.toBe(FOCUSED_FILL)

  const expectFill = (fill: string) =>
    surfaces().map((style) => {
      expect(style.backgroundColor).toBe(fill)
      expect(style.borderWidth ?? 0).toBe(0)
      expect(style.borderBottomWidth ?? 0).toBe(0)
      const { backgroundColor, ...layout } = style
      return layout
    })

  expectFill(startsFocused ? FOCUSED_FILL : RESTING_FILL)

  // Focused before each blur, so the blur has a state to undo whichever way it started.
  focus()
  expectFill(FOCUSED_FILL)

  blur()
  const resting = expectFill(RESTING_FILL)

  focus()
  const focused = expectFill(FOCUSED_FILL)

  expect(focused).toEqual(resting)
}
