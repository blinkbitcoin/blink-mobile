/**
 * Design constants for the universal busy state.
 *
 * Every measurement here comes from Figma `9MQuQi8ZhXVvDibWSI3C4c`, frames
 * 23646:128620 (start), 23646:128717 (end) and 29835:120215 (error). See
 * `docs/universal-busy-state-screen.md`.
 */

/** The round icon chip. 52×52 in Figma. */
export const CHIP_SIZE = 52

/** The glyph box inside a chip. Figma draws 31×32 at an inset of 10. */
export const CHIP_GLYPH_SIZE = 32

/** The gap the chips open between themselves, and so the connector's length. */
export const CONNECTOR_LENGTH = 60

export const CONNECTOR_STROKE_WIDTH = 1

/** Figma's dash pattern: 4 on, 4 off. */
export const DASH_ON = 4
export const DASH_OFF = 4

/**
 * One full dash period. The marching strip travels exactly this far and then
 * wraps, which is why the loop is seamless.
 */
export const DASH_PERIOD = DASH_ON + DASH_OFF

/** The row is a fixed box so the spread is pure transform, with no reflow. */
export const ROW_WIDTH = CHIP_SIZE * 2 + CONNECTOR_LENGTH

/**
 * How far each chip travels from the stacked start position.
 *
 * The chips begin exactly on top of each other at the row's centre and end one
 * `CONNECTOR_LENGTH` apart, so each moves half of the final centre-to-centre
 * distance.
 */
export const CHIP_TRAVEL = (CHIP_SIZE + CONNECTOR_LENGTH) / 2

/**
 * A beat of stillness before anything moves.
 *
 * The screen has usually just been pushed, so the entrance would otherwise
 * collide with the navigator's own transition and be half missed. Holding the
 * start state — one chip, alone, no line — for a moment also gives the "only the
 * key is here yet" reading time to land before the pair parts.
 */
export const ENTRANCE_DELAY_MS = 300

/** The one-shot entrance: chips spread and the gap opens. `timing.quick`. */
export const ENTRANCE_DURATION_MS = 300

/**
 * How long the dashes take to travel one `DASH_PERIOD`, i.e. the marching speed.
 *
 * 8pt per 400ms is 20pt/s, so a dash crosses the 60pt gap in three seconds.
 * This is the number most likely to want tuning on a device — it is the whole
 * speed control. Change it with `DASH_PERIOD` to keep the speed.
 */
export const DASH_TRAVEL_MS = 400

/**
 * The hard floor: the busy state may not end before its entrance has finished,
 * pause included. Applies to both completion kinds.
 */
export const MIN_VISIBLE_MS = ENTRANCE_DELAY_MS + ENTRANCE_DURATION_MS

/**
 * The default hold for a `timed` completion — a busy state that is only a
 * signal, with no real work behind it, and so needs long enough to be read.
 */
export const SIGNAL_MS = 3000

/** Vertical rhythm below the chip row, from the Figma `body` frame. */
export const ROW_TO_TEXT_GAP = 14
export const HEADING_TO_STATUS_GAP = 8
export const ROW_TOP_PADDING = 10

/** The text block's width in the 360pt Figma frame. */
export const TEXT_BLOCK_WIDTH = 264

/** Screen gutters, from the Figma `body` and `button-group` frames. */
export const SCREEN_PADDING = 20
export const BUTTONS_TOP_PADDING = 10
export const BUTTONS_GAP = 10

/**
 * Explicit stacking for the pictogram. Sibling order alone is not trusted: on
 * Android `elevation` outranks it, so the order is pinned with `zIndex`, which
 * both platforms honour the same way.
 */
export const Z_CONNECTOR = 0
export const Z_ICON_2 = 1
export const Z_ICON_1 = 2
