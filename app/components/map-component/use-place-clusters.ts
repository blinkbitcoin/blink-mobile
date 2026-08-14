import { useCallback, useMemo } from "react"
import { Dimensions } from "react-native"
import { Region } from "react-native-maps"
import Supercluster from "supercluster"

import { BtcMapPlace } from "@app/btcmap"

import { ClusterMarkerData } from "./cluster-marker"

// BTC Map stops clustering at zoom 17 and draws every pin from there in;
// supercluster's `maxZoom` is the last level it still clusters at.
const CLUSTERING_DISABLED_ZOOM = 17
const MAX_ZOOM = 20

const CLUSTER_OPTIONS = {
  radius: 60,
  maxZoom: CLUSTERING_DISABLED_ZOOM - 1,
  minPoints: 3,
}

// Clustering already bounds what is on screen, but a dense city at zoom 16 can
// still resolve to thousands of individual pins. Every pin is a native view, so
// the list is capped rather than allowed to lock up the map.
const MAX_RENDERED = 400

type PlaceProperties = { place: BtcMapPlace }

type ClusterOrPlace =
  | Supercluster.ClusterFeature<Supercluster.AnyProps>
  | Supercluster.PointFeature<PlaceProperties>

const EMPTY = { places: [] as BtcMapPlace[], clusters: [] as ClusterMarkerData[] }

// Tiles are 256dp wide, so a viewport of W dp at zoom z spans
// 360 * W / (256 * 2^z) degrees. Dropping the width term costs about two thirds
// of a zoom level on a phone, which is enough to keep clustering a whole level
// past where btcmap.org stops.
const TILE_SIZE = 256
const viewportWidth = () => Dimensions.get("window").width

/** The tile zoom at which the map is currently drawn. */
const zoomForRegion = (region: Region): number => {
  const span = Math.max(region.longitudeDelta, 1e-6)
  const zoom = Math.log2((360 * viewportWidth()) / (TILE_SIZE * span))
  return Math.max(0, Math.min(MAX_ZOOM, Math.round(zoom)))
}

const boundsForRegion = (region: Region): [number, number, number, number] => [
  region.longitude - region.longitudeDelta / 2,
  region.latitude - region.latitudeDelta / 2,
  region.longitude + region.longitudeDelta / 2,
  region.latitude + region.latitudeDelta / 2,
]

/**
 * Group ~30k places into what is worth drawing for the current viewport.
 *
 * Building the index is the expensive half and happens once per place list;
 * querying it per region change is cheap enough for the JS thread.
 */
export const usePlaceClusters = (places: BtcMapPlace[], region: Region | undefined) => {
  const index = useMemo(() => {
    if (!places.length) return null

    const clusterer = new Supercluster<PlaceProperties>(CLUSTER_OPTIONS)
    clusterer.load(
      places.map((place) => ({
        type: "Feature" as const,
        properties: { place },
        geometry: {
          type: "Point" as const,
          coordinates: [place.longitude, place.latitude],
        },
      })),
    )
    return clusterer
  }, [places])

  const visible = useMemo(() => {
    if (!index || !region) return EMPTY

    const features: ClusterOrPlace[] = index.getClusters(
      boundsForRegion(region),
      zoomForRegion(region),
    )

    const singles: BtcMapPlace[] = []
    const clusters: ClusterMarkerData[] = []

    for (const feature of features) {
      const [longitude, latitude] = feature.geometry.coordinates
      if ("cluster" in feature.properties) {
        clusters.push({
          id: String(feature.properties.cluster_id),
          latitude,
          longitude,
          count: feature.properties.point_count,
        })
      } else {
        singles.push(feature.properties.place)
      }
    }

    return {
      places: singles.slice(0, MAX_RENDERED),
      clusters: clusters.slice(0, MAX_RENDERED),
    }
  }, [index, region])

  /**
   * Where to fly when a cluster is tapped: the zoom at which supercluster would
   * break it apart, centred on it, keeping the viewport's aspect ratio.
   */
  const regionForCluster = useCallback(
    (cluster: ClusterMarkerData, current: Region): Region => {
      const expansionZoom = index
        ? index.getClusterExpansionZoom(Number(cluster.id))
        : zoomForRegion(current) + 2
      const zoom = Math.min(expansionZoom, MAX_ZOOM)

      const longitudeDelta = (360 * viewportWidth()) / (TILE_SIZE * 2 ** zoom)
      const aspect = current.latitudeDelta / Math.max(current.longitudeDelta, 1e-6)

      return {
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        longitudeDelta,
        latitudeDelta: longitudeDelta * aspect,
      }
    },
    [index],
  )

  return { ...visible, regionForCluster }
}
