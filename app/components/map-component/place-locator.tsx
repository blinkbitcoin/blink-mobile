import React from "react"
import { Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles } from "@rn-vui/themed"

import { PIN_HEIGHT, PinShape, usePinColor } from "./pin-shape"

const BAR_HEIGHT = 50
// Clear of the ODbL credit in the bottom-right corner, which the licence asks
// stay readable and which this bar would otherwise sit on top of.
const BAR_BOTTOM_GAP = 34

/** Where the bar's top edge is, for anything that has to stay above it. */
export const locatorBarTop = (bottomInset: number): number =>
  bottomInset + BAR_BOTTOM_GAP + BAR_HEIGHT

type Props = {
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Placing the pin for a new place.
 *
 * The pin does not move — the map does. It is drawn at the centre of the map
 * view and its tip is what the coordinates are read from, so where it points is
 * exactly the region's centre and there is nothing to measure or convert: pan
 * until the tip is over the door, then confirm.
 *
 * Everything here is `box-none` above the bar, so the map keeps every pan and
 * pinch it had before this opened. The bar itself takes its own taps.
 */
export const PlaceLocator: React.FC<Props> = ({ onConfirm, onCancel }) => {
  const { LL } = useI18nContext()
  const insets = useSafeAreaInsets()
  const styles = useStyles({ bottomInset: insets.bottom })
  const pinColor = usePinColor(false)

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.crosshair} pointerEvents="none">
        <View style={styles.hint}>
          <Text style={styles.hintText}>{LL.MapScreen.placePinHint()}</Text>
        </View>
        <PinShape color={pinColor} />
      </View>

      <View style={styles.bar}>
        <Pressable
          testID="cancel-add-place"
          style={styles.cancel}
          onPress={onCancel}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>{LL.common.cancel()}</Text>
        </Pressable>

        <Pressable
          testID="confirm-place-location"
          style={styles.confirm}
          onPress={onConfirm}
          accessibilityRole="button"
        >
          <Text style={styles.confirmText}>{LL.common.next()}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }, { bottomInset }: { bottomInset: number }) => ({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Full width so the hint above the pin has room to wrap, with the pin itself
  // centred inside it. The teardrop's point is its bottom edge, so lifting the
  // row by the pin's own height is what puts that point — rather than its
  // middle — on the centre of the map.
  crosshair: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    marginTop: -PIN_HEIGHT,
    alignItems: "center",
  },
  hint: {
    position: "absolute",
    alignSelf: "center",
    bottom: PIN_HEIGHT + 8,
    maxWidth: "80%",
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hintText: {
    fontSize: 13,
    color: colors.black,
    textAlign: "center",
  },
  bar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: bottomInset + BAR_BOTTOM_GAP,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  cancel: {
    flex: 1,
    minHeight: BAR_HEIGHT,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.primary,
  },
  confirm: {
    flex: 2,
    minHeight: BAR_HEIGHT,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  confirmText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.white,
  },
}))
