import React from "react"
import { View } from "react-native"
import { Marker } from "react-native-maps"
import Svg, { Circle } from "react-native-svg"

import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { useMarkerSettle } from "./use-marker-settle"

// Two concentric discs in one colour, the inner one more opaque. The size a
// cluster covers is already the count's signal, so — unlike btcmap.org, which
// steps green to amber to orange — the colour stays put and only the number
// changes.
//
// `_green` and not `success`: our palette defines no `success`, so reading it
// resolves to @rn-vui's own green and paints every cluster a library colour.
const CLUSTER_SIZE = 50
const VIEWBOX = 45
const OUTER_RADIUS = 22.5
const INNER_RADIUS = 16.5
const OUTER_OPACITY = 0.3
const INNER_OPACITY = 0.7

export type ClusterMarkerData = {
  id: string
  latitude: number
  longitude: number
  count: number
}

type Props = {
  cluster: ClusterMarkerData
  onPress: (cluster: ClusterMarkerData) => void
}

export const ClusterMarker: React.FC<Props> = React.memo(({ cluster, onPress }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  // Discs are react-native-svg like the pins are, so they need the same paint
  // window before tracking can be turned off — see use-marker-settle.
  const { markerRef, tracksViewChanges } = useMarkerSettle(
    `${colors._green}|${cluster.count}`,
  )

  return (
    <Marker
      ref={markerRef}
      identifier={`btcmap-cluster-${cluster.id}`}
      testID={`btcmap-cluster-${cluster.id}`}
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      onPress={() => onPress(cluster)}
    >
      <View style={styles.cluster}>
        <Svg
          width={CLUSTER_SIZE}
          height={CLUSTER_SIZE}
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        >
          <Circle
            cx={VIEWBOX / 2}
            cy={VIEWBOX / 2}
            r={OUTER_RADIUS}
            fill={colors._green}
            fillOpacity={OUTER_OPACITY}
          />
          <Circle
            cx={VIEWBOX / 2}
            cy={VIEWBOX / 2}
            r={INNER_RADIUS}
            fill={colors._green}
            fillOpacity={INNER_OPACITY}
          />
        </Svg>
        <View style={styles.countOverlay} pointerEvents="none">
          <Text style={styles.count}>{cluster.count}</Text>
        </View>
      </View>
    </Marker>
  )
})

ClusterMarker.displayName = "ClusterMarker"

const useStyles = makeStyles(({ colors }) => ({
  cluster: {
    width: CLUSTER_SIZE,
    height: CLUSTER_SIZE,
  },
  countOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  count: {
    fontSize: 14,
    fontWeight: "bold",
    // The inner disc carries the accent at 70% in both themes, so the count is
    // pinned white rather than following the theme's inverted `black`.
    color: colors._white,
  },
}))
