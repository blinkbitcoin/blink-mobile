import React from "react"
import { View } from "react-native"
import { Marker } from "react-native-maps"
import Svg, { Circle } from "react-native-svg"

import { Text, makeStyles } from "@rn-vui/themed"

// BTC Map's cluster discs: two translucent circles that step from green to
// amber to orange as the count grows. Same values in both themes.
const CLUSTER_SIZE = 40
const OUTER_RADIUS = 20
const INNER_RADIUS = 15

const CLUSTER_TIERS = [
  { upTo: 9, outer: "rgba(181,226,140,0.6)", inner: "rgba(110,204,57,0.6)" },
  { upTo: 99, outer: "rgba(241,211,87,0.6)", inner: "rgba(240,194,12,0.6)" },
  { upTo: Infinity, outer: "rgba(253,156,115,0.6)", inner: "rgba(241,128,23,0.6)" },
]

const tierFor = (count: number) =>
  CLUSTER_TIERS.find((tier) => count <= tier.upTo) ?? CLUSTER_TIERS[2]

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
  const tier = tierFor(cluster.count)

  return (
    <Marker
      identifier={`btcmap-cluster-${cluster.id}`}
      testID={`btcmap-cluster-${cluster.id}`}
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      onPress={() => onPress(cluster)}
    >
      <View style={styles.cluster}>
        <Svg width={CLUSTER_SIZE} height={CLUSTER_SIZE}>
          <Circle
            cx={CLUSTER_SIZE / 2}
            cy={CLUSTER_SIZE / 2}
            r={OUTER_RADIUS}
            fill={tier.outer}
          />
          <Circle
            cx={CLUSTER_SIZE / 2}
            cy={CLUSTER_SIZE / 2}
            r={INNER_RADIUS}
            fill={tier.inner}
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
    fontSize: 12,
    fontWeight: "bold",
    // The discs are pale in every tier, so the count stays black in dark mode
    // too rather than following the theme's inverted `black`.
    color: colors._black,
  },
}))
