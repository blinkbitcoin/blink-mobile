import React from "react"
import { View } from "react-native"
import { Marker } from "react-native-maps"

import { LatLng } from "@app/btcmap"
import { makeStyles } from "@rn-vui/themed"

import { PIN_ANCHOR } from "./marker-layout"
import { PIN_HEIGHT, PIN_WIDTH, PinShape, usePinColor } from "./pin-shape"
import { useMarkerSettle } from "./use-marker-settle"

type Props = {
  coordinate: LatLng
}

/**
 * The new place's pin once Continue has fixed where it is.
 *
 * Until then the pin is `PlaceLocator`, drawn at the centre of the map view
 * and aimed by panning under it. After Continue the panel submits the
 * coordinate it took at that moment, and a crosshair at the map's centre would
 * go on moving with every pan to a door that is no longer the one being sent.
 * So the pin becomes a marker on the map itself: it stays on the place while
 * the map moves, and it carries no instruction to move it.
 *
 * The same teardrop and fill as the locator, with no glyph — the place has no
 * category on the map until BTC Map has reviewed it.
 */
export const PinnedPlaceMarker: React.FC<Props> = ({ coordinate }) => {
  const styles = useStyles()
  // Never a boosted place — it is not a place at all yet.
  const color = usePinColor(false)
  const { markerRef, tracksViewChanges } = useMarkerSettle(color)

  return (
    <Marker
      ref={markerRef}
      identifier="pinned-place"
      testID="pinned-place-pin"
      coordinate={coordinate}
      anchor={PIN_ANCHOR}
      tracksViewChanges={tracksViewChanges}
      tappable={false}
    >
      <View style={styles.pin}>
        <PinShape color={color} />
      </View>
    </Marker>
  )
}

const useStyles = makeStyles(() => ({
  pin: {
    width: PIN_WIDTH,
    height: PIN_HEIGHT,
  },
}))
