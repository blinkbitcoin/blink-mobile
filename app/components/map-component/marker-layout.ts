// Marker geometry, kept apart from the components that draw it so the anchors
// can be read and tested without rendering a native view.

export const LABEL_MAX_WIDTH = 132
export const LABEL_LINE_HEIGHT = 14
export const LABEL_GAP = 2

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
 * The label hangs from the same coordinate, just below the tip — which is where
 * it appeared when it lived inside the pin's view, so nothing moves on screen.
 */
export const LABEL_ANCHOR = { x: 0.5, y: 0 }
