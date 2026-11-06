/**
 * The smallest touch box a header control gets, in dp (Material's 48dp minimum). On Android the new
 * architecture drops a touch that lands outside a parent's layout bounds before it
 * reaches a child's `hitSlop`, and the native header wraps each item in a view sized
 * to its content. So `hitSlop` cannot widen a header control: only its own box counts.
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
