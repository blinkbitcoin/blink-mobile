// Marker geometry, kept apart from the components that draw it so the anchor
// arithmetic can be read and tested without rendering a native view.

import { PIN_HEIGHT } from "./pin-shape"

export const LABEL_MAX_WIDTH = 132
export const LABEL_LINE_HEIGHT = 14
export const LABEL_GAP = 2

/**
 * The marker view's height, which the anchor is derived from.
 *
 * The teardrop's tip has to land on the place's coordinate, so the anchor is the
 * tip's position as a fraction of the whole view — not a constant. Adding a
 * label below the pin makes the view taller, and an anchor left at 1 would push
 * every labelled pin north of where it actually is.
 */
export const markerHeight = (hasLabel: boolean): number =>
  hasLabel ? PIN_HEIGHT + LABEL_GAP + LABEL_LINE_HEIGHT : PIN_HEIGHT

export const markerAnchor = (hasLabel: boolean) => ({
  x: 0.5,
  y: PIN_HEIGHT / markerHeight(hasLabel),
})
