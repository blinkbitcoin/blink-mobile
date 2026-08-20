// Marker geometry, kept apart from the components that draw it so the anchors
// can be read and tested without rendering a native view.

import { PIN_HEIGHT, PIN_WIDTH } from "./pin-shape"

export const LABEL_MAX_WIDTH = 132
export const LABEL_LINE_HEIGHT = 14
export const LABEL_FONT_SIZE = 11

/**
 * The pin's teardrop tip sits on the place's coordinate.
 *
 * This is only a constant because the pin is drawn by itself, in a marker whose
 * view holds nothing but the teardrop. It used to share that view with the
 * merchant's name, and that does not work: Android rasterises a custom marker
 * into a bitmap sized by the view's own layout, the view was sized by its widest
 * child, and so the pin's position *inside its own bitmap* depended on how many
 * characters the merchant's name had. Measured on device — "Engen" laid the view
 * out at 32dp (the pin's own width), "Pick n Pay" at 46.5dp.
 *
 * Any disagreement between the bitmap's size and the layout it was captured from
 * then slices the pin rather than shifting it: with a long name the pin sits
 * ~50dp into a 132dp view, so a bitmap captured at an older, narrower width
 * clips everything but its leading edge — a thin orange crescent where a marker
 * should be, frozen there until something else forces a repaint.
 */
export const PIN_ANCHOR = { x: 0.5, y: 1 }

/**
 * How far right of the coordinate the name starts — clear of the pin's widest
 * point, plus a gap.
 *
 * The name sits beside the pin rather than under its tip, which is where
 * btcmap.org puts it and is most of why their map stays legible where ours did
 * not. A name under the tip is centred on it, so it reaches half its own width
 * to either side of a pin that is 32dp wide: two pins a thumb apart have already
 * collided. Beside the pin the name only ever extends one way, and the strip it
 * occupies is the one the pin below it does not.
 */
export const LABEL_OFFSET_X = PIN_WIDTH / 2 + 6

/**
 * How far *above* the coordinate the name's own middle sits: level with the
 * middle of the pin's head, so the two read as one object.
 *
 * The pin's head is the circular part of the teardrop, whose centre is at its
 * own width's radius down from the top — 16 of the 43dp the pin is tall, so 27
 * up from the tip that rests on the coordinate. Two of those dp go back to
 * optical centring against the glyph inside the head.
 */
export const LABEL_OFFSET_Y = -(PIN_HEIGHT - PIN_WIDTH / 2 - 2)

/**
 * The label marker's own bottom-left corner sits on the coordinate.
 *
 * Left, so the anchor does not move when the view's width follows its text —
 * which it is allowed to do here, unlike in the pin's view, because there is no
 * pin inside this one whose position that could disturb. The offsets above are
 * then padding inside the view rather than a shift of the anchor: padding grows
 * the view away from a corner that stays put, where a fractional anchor would
 * have to be recomputed for every name.
 */
export const LABEL_ANCHOR = { x: 0, y: 1 }

/**
 * The transparent strip below the text that lifts it to `LABEL_OFFSET_Y`.
 *
 * With the view anchored by its bottom edge, the text's middle ends up this far
 * plus half a line above the coordinate.
 */
export const LABEL_BASELINE_DROP = -LABEL_OFFSET_Y - LABEL_LINE_HEIGHT / 2

/**
 * Room around the text for its halo, which is a shadow and paints outside the
 * glyphs. Without it the view clips the halo off the top and the trailing edge,
 * and the name loses exactly the contrast that keeps it readable over a street.
 */
export const LABEL_HALO_PADDING = 3
