/**
 * Toast placement in dp, not a percent of the window.
 *
 * A fixed inset is the same gap on every phone, OS, and density. Safe-area
 * insets cover the notch, Dynamic Island, and landscape cutouts. At the
 * Material compact/medium breakpoint (600dp) the row stops growing and
 * centres, so a tablet or a landscape phone does not get a full-bleed banner.
 * 480 matches the keyboard cap already used in the app.
 *
 * react-native-modal insets its content by 5% of the window on every side
 * (modal.js `computedStyle`). That percent is not a gap: it stacks on the
 * 20dp inset and grows on a tablet. Modal mounts cancel it so the inset is
 * measured from the window.
 */
export const TOAST_EDGE_INSET = 20
export const TOAST_TOP_GAP = 40
export const TOAST_MAX_WIDTH = 480
export const TABLET_MIN_WIDTH = 600
export const MODAL_CONTENT_MARGIN_RATIO = 0.05

export const toastSideInset = (
  screenWidth: number,
  safeLeft = 0,
  safeRight = 0,
): { marginLeft: number; marginRight: number } => {
  const minLeft = Math.max(TOAST_EDGE_INSET, safeLeft)
  const minRight = Math.max(TOAST_EDGE_INSET, safeRight)
  const available = Math.max(0, screenWidth - minLeft - minRight)

  if (screenWidth < TABLET_MIN_WIDTH) {
    return { marginLeft: minLeft, marginRight: minRight }
  }

  const width = Math.min(TOAST_MAX_WIDTH, available)
  const extra = available - width
  return {
    marginLeft: minLeft + extra / 2,
    marginRight: minRight + extra / 2,
  }
}

export const toastTopOffset = ({
  safeTop,
  inModal,
  platform,
}: {
  safeTop: number
  inModal: boolean
  platform: string
}): number => {
  // Android Modal leaves statusBarTranslucent off, so the dialog already
  // starts below the status bar (fitsSystemWindows, edge-to-edge disabled).
  // The root safe-area inset would drop the toast by that much again.
  if (inModal && platform === "android") return TOAST_TOP_GAP
  return safeTop + TOAST_TOP_GAP
}

export const modalContentBleed = (screenWidth: number, inModal: boolean): number =>
  inModal ? screenWidth * MODAL_CONTENT_MARGIN_RATIO : 0
