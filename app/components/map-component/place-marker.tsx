import React from "react"
import { View } from "react-native"
import { Marker } from "react-native-maps"
import MaterialIcon from "react-native-vector-icons/MaterialIcons"

import { BtcMapPlace, isBoosted, materialIconName } from "@app/btcmap"
import { Text, makeStyles } from "@rn-vui/themed"

import {
  LABEL_GAP,
  LABEL_LINE_HEIGHT,
  LABEL_MAX_WIDTH,
  MARKER_ANCHOR,
} from "./marker-layout"
import { useMarkerSettle } from "./use-marker-settle"
import {
  PIN_GLYPH_COLOR,
  PIN_GLYPH_LEFT,
  PIN_GLYPH_SIZE,
  PIN_GLYPH_TOP,
  PIN_HEIGHT,
  PIN_WIDTH,
  PinShape,
  usePinColor,
} from "./pin-shape"

type Props = {
  place: BtcMapPlace
  name?: string
  onPress: (place: BtcMapPlace) => void
}

export const PlaceMarker: React.FC<Props> = React.memo(({ place, name, onPress }) => {
  const styles = useStyles()
  // Read at render time, and this component is memoised, so nothing schedules a
  // repaint at the moment a boost lapses — a pin can stay orange until the next
  // pan re-renders it. That is deliberate: boosts run for days, every region
  // change re-renders the markers anyway, and a timer per pin to close a gap
  // nobody can see would undo the point of `useMarkerSettle`.
  const color = usePinColor(isBoosted(place.boostedUntil, new Date()))
  const glyph = materialIconName(place.icon)

  // The label is part of what gets rasterised, so it belongs in the settle key —
  // a name arriving after the pin has painted has to reopen the paint window.
  const { markerRef, tracksViewChanges } = useMarkerSettle(
    `${glyph}|${color}|${name ?? ""}`,
  )

  return (
    <Marker
      ref={markerRef}
      identifier={`btcmap-place-${place.id}`}
      testID={`btcmap-place-${place.id}`}
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      anchor={MARKER_ANCHOR}
      tracksViewChanges={tracksViewChanges}
      onPress={() => onPress(place)}
    >
      <View style={styles.marker}>
        <View style={styles.pin}>
          <PinShape color={color} />
          <MaterialIcon
            name={glyph}
            size={PIN_GLYPH_SIZE}
            color={PIN_GLYPH_COLOR}
            style={styles.glyph}
          />
        </View>

        {/* Always present, even with nothing in it — the anchor is computed from
            this view's height, and a row that appears when a name arrives would
            move every labelled pin off its coordinate. See marker-layout.ts. */}
        <View style={styles.labelRow}>
          {Boolean(name) && (
            /* Font scaling is off and the line count fixed for the same reason:
               text that grows changes the height the anchor was derived from.
               The full name is one tap away in the sheet. */
            <Text
              style={styles.label}
              numberOfLines={1}
              ellipsizeMode="tail"
              allowFontScaling={false}
            >
              {name}
            </Text>
          )}
        </View>
      </View>
    </Marker>
  )
})

PlaceMarker.displayName = "PlaceMarker"

const useStyles = makeStyles(({ colors }) => ({
  marker: {
    alignItems: "center",
  },
  pin: {
    width: PIN_WIDTH,
    height: PIN_HEIGHT,
  },
  glyph: {
    position: "absolute",
    left: PIN_GLYPH_LEFT,
    top: PIN_GLYPH_TOP,
  },
  labelRow: {
    height: LABEL_LINE_HEIGHT,
    marginTop: LABEL_GAP,
    maxWidth: LABEL_MAX_WIDTH,
    overflow: "hidden",
  },
  label: {
    fontSize: 11,
    lineHeight: LABEL_LINE_HEIGHT,
    fontWeight: "600",
    color: colors.black,
    textAlign: "center",
    // React Native has no text halo, and a label has to stay readable over
    // whatever the basemap puts behind it.
    textShadowColor: colors.white,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
}))
