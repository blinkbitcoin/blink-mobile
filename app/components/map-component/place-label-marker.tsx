import React from "react"
import { View } from "react-native"
import { Marker } from "react-native-maps"

import { BtcMapPlace } from "@app/btcmap"
import { Text, makeStyles } from "@rn-vui/themed"

import {
  LABEL_ANCHOR,
  LABEL_GAP,
  LABEL_LINE_HEIGHT,
  LABEL_MAX_WIDTH,
} from "./marker-layout"
import { useMarkerSettle } from "./use-marker-settle"

type Props = {
  place: BtcMapPlace
  name: string
  onPress: (place: BtcMapPlace) => void
}

/**
 * The merchant's name, as its own marker hanging under the pin's tip.
 *
 * Names are not in the offline snapshot; they arrive from a viewport request
 * some time after the pins have drawn. Giving them their own marker means that
 * arrival mounts something new rather than resizing something already rasterised
 * — and this view's own width is allowed to follow its text, because there is no
 * pin inside it whose position that could disturb.
 *
 * It is still tappable, so reaching for the name opens the place rather than
 * doing nothing.
 */
export const PlaceLabelMarker: React.FC<Props> = React.memo(
  ({ place, name, onPress }) => {
    const styles = useStyles()
    const { markerRef, tracksViewChanges } = useMarkerSettle(name)

    return (
      <Marker
        ref={markerRef}
        identifier={`btcmap-label-${place.id}`}
        testID={`btcmap-label-${place.id}`}
        coordinate={{ latitude: place.latitude, longitude: place.longitude }}
        anchor={LABEL_ANCHOR}
        tracksViewChanges={tracksViewChanges}
        onPress={() => onPress(place)}
      >
        <View style={styles.labelRow}>
          {/* Font scaling is off and the line count fixed on purpose: this view
              is rasterised to a bitmap, and text that grows past what was
              measured is text that gets clipped out of it. The full name is one
              tap away in the sheet. */}
          <Text
            style={styles.label}
            numberOfLines={1}
            ellipsizeMode="tail"
            allowFontScaling={false}
          >
            {name}
          </Text>
        </View>
      </Marker>
    )
  },
)

PlaceLabelMarker.displayName = "PlaceLabelMarker"

const useStyles = makeStyles(({ colors }) => ({
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
