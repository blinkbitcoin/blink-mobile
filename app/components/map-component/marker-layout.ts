// Marker geometry, kept apart from the components that draw it so the anchor
// arithmetic can be read and tested without rendering a native view.

import { PIN_HEIGHT } from "./pin-shape"

export const LABEL_MAX_WIDTH = 132
export const LABEL_LINE_HEIGHT = 14
export const LABEL_GAP = 2

/**
 * The marker view's height — constant, including for a pin with no name yet.
 *
 * The teardrop's tip has to land on the place's coordinate, so the anchor is the
 * tip's position as a fraction of the whole view. Sizing the view to whether a
 * label is present would move that fraction the moment a name arrives, and names
 * arrive from a separate request long after the pins are drawn.
 *
 * That is worse than it sounds on Android. `anchor` is applied to the marker
 * immediately, while the bitmap is only re-rasterised when the view is being
 * tracked — so for as long as the two disagree the pin sits ~12px below its own
 * coordinate, and if the re-rasterisation is missed it stays there. Reserving
 * the label's row always costs an empty strip nothing is drawn in, and buys an
 * anchor that never moves.
 */
export const MARKER_HEIGHT = PIN_HEIGHT + LABEL_GAP + LABEL_LINE_HEIGHT

/** Horizontally centred, vertically on the teardrop's tip. */
export const MARKER_ANCHOR = { x: 0.5, y: PIN_HEIGHT / MARKER_HEIGHT }
