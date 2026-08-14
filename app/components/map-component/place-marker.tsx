import React from "react"
import { View } from "react-native"
import { Marker } from "react-native-maps"
import MaterialIcon from "react-native-vector-icons/MaterialIcons"

import { BtcMapPlace, isBoosted, materialIconName } from "@app/btcmap"
import { makeStyles } from "@rn-vui/themed"

import { useMarkerSettle } from "./use-marker-settle"
import {
  PIN_COLOR,
  PIN_COLOR_BOOSTED,
  PIN_GLYPH_COLOR,
  PIN_GLYPH_LEFT,
  PIN_GLYPH_SIZE,
  PIN_GLYPH_TOP,
  PIN_HEIGHT,
  PIN_WIDTH,
  PinShape,
} from "./pin-shape"

type Props = {
  place: BtcMapPlace
  onPress: (place: BtcMapPlace) => void
}

export const PlaceMarker: React.FC<Props> = React.memo(({ place, onPress }) => {
  const styles = useStyles()
  const color = isBoosted(place.boostedUntil, new Date()) ? PIN_COLOR_BOOSTED : PIN_COLOR
  const glyph = materialIconName(place.icon)

  const tracksViewChanges = useMarkerSettle(`${glyph}|${color}`)

  return (
    <Marker
      identifier={`btcmap-place-${place.id}`}
      testID={`btcmap-place-${place.id}`}
      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      onPress={() => onPress(place)}
    >
      <View style={styles.pin}>
        <PinShape color={color} />
        <MaterialIcon
          name={glyph}
          size={PIN_GLYPH_SIZE}
          color={PIN_GLYPH_COLOR}
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
