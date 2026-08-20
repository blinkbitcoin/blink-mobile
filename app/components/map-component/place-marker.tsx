import React from "react"
import { View } from "react-native"
import { Marker } from "react-native-maps"
import MaterialIcon from "react-native-vector-icons/MaterialIcons"

import { BtcMapPlace, isBoosted, materialIconName } from "@app/btcmap"
import { makeStyles } from "@rn-vui/themed"

import { PIN_ANCHOR } from "./marker-layout"
import { useMarkerSettle } from "./use-marker-settle"
import {
  PIN_GLYPH_LEFT,
  PIN_GLYPH_SIZE,
  PIN_GLYPH_TOP,
  PIN_HEIGHT,
  PIN_WIDTH,
  PinShape,
  usePinColor,
  usePinGlyphColor,
} from "./pin-shape"

type Props = {
  place: BtcMapPlace
  onPress: (place: BtcMapPlace) => void
}

/**
 * One teardrop, and nothing else.
 *
 * The merchant's name is drawn by `PlaceLabelMarker` at the same coordinate
 * rather than inside this view. Keeping it out is what makes this marker's
 * bitmap deterministic: the view is exactly the pin's size whatever the place is
 * called, so a name arriving — which happens long after the pin has painted and
 * frozen — cannot resize it, cannot move the pin within it, and cannot leave a
 * sliced bitmap behind. See `marker-layout.ts`.
 */
export const PlaceMarker: React.FC<Props> = React.memo(({ place, onPress }) => {
  const styles = useStyles()
  // Read at render time, and this component is memoised, so nothing schedules a
  // repaint at the moment a boost lapses — a pin can stay orange until the next
  // pan re-renders it. That is deliberate: boosts run for days, every region
  // change re-renders the markers anyway, and a timer per pin to close a gap
  // nobody can see would undo the point of `useMarkerSettle`.
  const color = usePinColor(isBoosted(place.boostedUntil, new Date()))
  const glyphColor = usePinGlyphColor()
  const glyph = materialIconName(place.icon)

  // No name in the key: nothing about the label reaches these pixels any more.
  const { markerRef, tracksViewChanges } = useMarkerSettle(`${glyph}|${color}`)

  return (
    <Marker
      ref={markerRef}
      identifier={`btcmap-place-${place.id}`}
      testID={`btcmap-place-${place.id}`}
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      anchor={PIN_ANCHOR}
      tracksViewChanges={tracksViewChanges}
      onPress={() => onPress(place)}
    >
      <View style={styles.pin}>
        <PinShape color={color} />
        <MaterialIcon
          name={glyph}
          size={PIN_GLYPH_SIZE}
          color={glyphColor}
          style={styles.glyph}
        />
      </View>
    </Marker>
  )
})

PlaceMarker.displayName = "PlaceMarker"

const useStyles = makeStyles(() => ({
  pin: {
    width: PIN_WIDTH,
    height: PIN_HEIGHT,
  },
  glyph: {
    position: "absolute",
    left: PIN_GLYPH_LEFT,
    top: PIN_GLYPH_TOP,
  },
}))
