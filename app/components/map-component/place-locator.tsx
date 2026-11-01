import React from "react"
import { View } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles } from "@rn-vui/themed"

import { NewPlacePinShape, OUTLINED_PIN_HEIGHT, OUTLINED_PIN_TIP_Y } from "./pin-shape"

/**
 * The pin for a new place, and what to do with it.
 *
 * The pin does not move — the map does. It is drawn at the centre of the map
 * view and its tip is what the coordinates are read from, so where it points is
 * exactly the region's centre and there is nothing to measure or convert: pan
 * until the tip is over the door.
 *
 * Nothing here takes a touch. There is no control on it — the form below the
 * map has them — and the map underneath keeps every pan and pinch it had
 * before this opened.
 */
export const PlaceLocator: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  return (
    <View testID="place-pin" style={styles.crosshair} pointerEvents="none">
      <View style={styles.hint}>
        <Text style={styles.hintText}>{LL.MapScreen.placePinHint()}</Text>
      </View>
      <NewPlacePinShape />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  // Full width so the hint above the pin has room to wrap, with the pin itself
  // centred inside it. The teardrop's point is its bottom edge, so lifting the
  // row by the pin's own height is what puts that point — rather than its
  // middle — on the centre of the map. The ring sits outside the teardrop, so
  // the point is the ring's width above the box's bottom edge, not on it.
  crosshair: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    marginTop: -OUTLINED_PIN_TIP_Y,
    alignItems: "center",
  },
  hint: {
    position: "absolute",
    alignSelf: "center",
    bottom: OUTLINED_PIN_HEIGHT + 8,
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
}))
