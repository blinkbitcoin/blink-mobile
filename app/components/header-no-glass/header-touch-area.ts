import { circleDiameterThatContainsSquare } from "../atomic/galoy-icon/galoy-icon"

/**
 * The smallest touch box a header control gets, in dp (Material's 48dp minimum). On Android the new
 * architecture drops a touch that lands outside a parent's layout bounds before it
 * reaches a child's `hitSlop`, and the native header wraps each item in a view sized
 * to its content. So `hitSlop` cannot widen a header control: only its own box counts.
 * Never cancel the box with negative margins either: the native header item sizes itself
 * to the margin box, so the strips the margins take back stop receiving touches.
 */
export const HEADER_ICON_TOUCH_SIZE = 48

/** A header control's box, its content centered, so a smaller icon keeps its place
 *  once the margin around the box is cut by the difference. */
export const headerIconTouchArea = {
  width: HEADER_ICON_TOUCH_SIZE,
  height: HEADER_ICON_TOUCH_SIZE,
  alignItems: "center",
  justifyContent: "center",
} as const

/** A medium `GaloyIconButton` is a 34dp circle (24dp icon); this much `touchPadding`
 *  on each side makes it the 48dp header box. */
export const HEADER_ICON_BUTTON_TOUCH_PADDING =
  (HEADER_ICON_TOUCH_SIZE - circleDiameterThatContainsSquare(24)) / 2

/** For an in-screen header row with no room under its buttons: the box grows up and
 *  sideways only (48×41dp), so nothing below the row moves. */
export const headerIconButtonTouchPaddingAbove = {
  top: HEADER_ICON_BUTTON_TOUCH_PADDING,
  right: HEADER_ICON_BUTTON_TOUCH_PADDING,
  left: HEADER_ICON_BUTTON_TOUCH_PADDING,
} as const
