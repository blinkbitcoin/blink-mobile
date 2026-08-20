import React from "react"
import { View } from "react-native"
import { Marker } from "react-native-maps"

import { BtcMapPlace } from "@app/btcmap"
import { Text, makeStyles } from "@rn-vui/themed"

import {
  LABEL_ANCHOR,
  LABEL_BASELINE_DROP,
  LABEL_FONT_SIZE,
  LABEL_HALO_PADDING,
  LABEL_LINE_HEIGHT,
  LABEL_MAX_WIDTH,
  LABEL_OFFSET_X,
} from "./marker-layout"
import { useMarkerSettle } from "./use-marker-settle"

/**
 * The halo behind a name in light mode: the theme's `white` taken 60% of the way
 * to black.
 *
 * A pure white halo disappears into a pale basemap and leaves the text with
 * nothing but its own weight to hold it off the roads underneath. Darkening the
 * halo gives the glyphs an edge that reads at a glance without turning into an
 * offset drop shadow, which at this size smears the counters shut.
 *
 * Dark mode needs no equivalent constant: the theme's `white` is already
 * `#000000` there, which is as dark as this can go.
 */
export const LABEL_HALO_COLOR_LIGHT = "#666666"

type Props = {
  place: BtcMapPlace
  name: string
  onPress: (place: BtcMapPlace) => void
}

/**
 * The merchant's name, as its own marker standing beside the pin.
 *
 * Names are not in the offline snapshot; they arrive from a viewport request
 * some time after the pins have drawn. Giving them their own marker means that
 * arrival mounts something new rather than resizing something already rasterised
 * — and this view's own width is allowed to follow its text, because there is no
 * pin inside it whose position that could disturb.
 *
 * It is still tappable, so reaching for the name opens the place rather than
 * doing nothing.
 *
 * Whether a name is drawn at all is not decided here: `placeLabels` runs the
 * collision pass over the whole viewport and the map only mounts the winners.
 * Nothing in this view may move the text away from where that pass expects it,
 * or the boxes it reserved stop describing the pixels — see `marker-layout.ts`
 * for the offsets both sides read.
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

const useStyles = makeStyles(({ colors, mode }) => ({
  // Padding rather than a shift of the anchor: the view's bottom-left corner is
  // what sits on the coordinate, so growing it up and to the right leaves that
  // corner — and therefore the anchor — where it is for every name.
  labelRow: {
    paddingLeft: LABEL_OFFSET_X,
    paddingBottom: LABEL_BASELINE_DROP,
    paddingTop: LABEL_HALO_PADDING,
    paddingRight: LABEL_HALO_PADDING,
  },
  label: {
    height: LABEL_LINE_HEIGHT,
    maxWidth: LABEL_MAX_WIDTH,
    fontSize: LABEL_FONT_SIZE,
    lineHeight: LABEL_LINE_HEIGHT,
    fontWeight: "600",
    color: colors.black,
    // Beside the pin, not under it: the text grows away from the pin rather
    // than to both sides of it.
    textAlign: "left",
    // React Native has no text halo, and a label has to stay readable over
    // whatever the basemap puts behind it. `colors.white` is the background
    // token, so it inverts with the mode and the halo is always the opposite of
    // the glyphs — black behind white text in dark mode, and in light mode the
    // darkened white above rather than the flat one, which the basemap swallows.
    textShadowColor: mode === "dark" ? colors.white : LABEL_HALO_COLOR_LIGHT,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
}))
