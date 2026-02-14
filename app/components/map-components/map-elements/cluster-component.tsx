import React from "react"
import { Marker } from "react-native-maps"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { IMarker } from "@app/screens/map-screen/btc-map-interface.ts"
import { supercluster } from "react-native-clusterer"
import ClusterIcon from "@app/components/map-components/map-elements/cluster-icon.tsx"

const ClusterComponent = React.memo(
  ({
    cluster,
    onPress,
  }: {
    cluster: supercluster.ClusterFeature<IMarker>
    onPress: (cluster: supercluster.ClusterFeature<IMarker>) => void
  }) => {
    const [longitude, latitude] = cluster.geometry.coordinates
    const coordinate = { latitude, longitude }
    const {
      theme: { colors },
    } = useTheme()
    const color = (() => {
      return colors.success
    })()
    return (
      <Marker
        identifier={`cluster-${cluster.properties.cluster_id}`}
        coordinate={coordinate}
        onPress={() => onPress(cluster)}
      >
        <ClusterIcon size={50} color={color} count={cluster.properties.point_count} />
      </Marker>
    )
  },
)
ClusterComponent.displayName = "ClusterComponent"

const useStyles = makeStyles(({ colors }) => ({
  clusterContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  clusterText: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.white,
  },
}))

export default ClusterComponent
