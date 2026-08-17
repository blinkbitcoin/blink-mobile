import React from "react"
import { View } from "react-native"
import { Marker } from "react-native-maps"
import MaterialIcon from "react-native-vector-icons/MaterialIcons"

import { BtcMapPlace, isBoosted, materialIconName } from "@app/btcmap"
import { Text, makeStyles } from "@rn-vui/themed"

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

const LABEL_MAX_WIDTH = 132
const LABEL_LINE_HEIGHT = 14
const LABEL_GAP = 2

/**
 * The marker view's height, which the anchor is derived from.
 *
 * The teardrop's tip has to land on the place's coordinate, so the anchor is the
 * tip's position as a fraction of the whole view — not a constant. Adding a
 * label below the pin makes the view taller, and an anchor left at 1 would push
 * every labelled pin north of where it actually is.
 */
export const markerHeight = (hasLabel: boolean): number =>
  hasLabel ? PIN_HEIGHT + LABEL_GAP + LABEL_LINE_HEIGHT : PIN_HEIGHT

export const markerAnchor = (hasLabel: boolean) => ({
  x: 0.5,
  y: PIN_HEIGHT / markerHeight(hasLabel),
})

type Props = {
  place: BtcMapPlace
  name?: string
  onPress: (place: BtcMapPlace) => void
}

export const PlaceMarker: React.FC<Props> = React.memo(({ place, name, onPress }) => {
  const styles = useStyles()
  const color = usePinColor(isBoosted(place.boostedUntil, new Date()))
  const glyph = materialIconName(place.icon)
  const hasLabel = Boolean(name)

  // The label is part of what gets rasterised, so it belongs in the settle key —
  // a name arriving after the pin has painted has to reopen the paint window.
  const tracksViewChanges = useMarkerSettle(`${glyph}|${color}|${name ?? ""}`)

  return (
    <Marker
      identifier={`btcmap-place-${place.id}`}
      testID={`btcmap-place-${place.id}`}
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      anchor={markerAnchor(hasLabel)}
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

        {hasLabel && (
          <View style={styles.labelRow}>
            {/* Font scaling is off and the line count fixed on purpose: the
                anchor is computed from this view's height, so text that grows
                would drag every labelled pin off its coordinate. The full name
                is one tap away in the sheet. */}
            <Text
              style={styles.label}
              numberOfLines={1}
              ellipsizeMode="tail"
              allowFontScaling={false}
            >
              {name}
            </Text>
          </View>
        )}
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
