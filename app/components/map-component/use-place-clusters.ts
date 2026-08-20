import { useCallback, useEffect, useMemo } from "react"
import { Region } from "react-native-maps"
import Supercluster from "supercluster"

import { BtcMapPlace } from "@app/btcmap"
import { recordAppError } from "@app/utils/error-reporting"

import { ClusterMarkerData } from "./cluster-marker"
import { MAX_ZOOM, longitudeDeltaForZoom, zoomForRegion } from "./viewport"

// BTC Map stops clustering at zoom 17 and draws every pin from there in;
// supercluster's `maxZoom` is the last level it still clusters at.
const CLUSTERING_DISABLED_ZOOM = 17

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

const EMPTY = {
  places: [] as BtcMapPlace[],
  clusters: [] as ClusterMarkerData[],
  dropped: 0,
}

const boundsForRegion = (region: Region): [number, number, number, number] => [
  region.longitude - region.longitudeDelta / 2,
  region.latitude - region.latitudeDelta / 2,
  region.longitude + region.longitudeDelta / 2,
  region.latitude + region.latitudeDelta / 2,
]

/**
 * How far a place sits from the middle of the screen, for ranking only.
 *
 * Planar and squared — the real distance is never needed, just the order — with
 * longitude scaled by latitude so the comparison stays sane away from the
 * equator. Anything that would make this wrong (the antimeridian) is a viewport
 * spanning half the globe, which is well inside clustering territory anyway.
 */
const offCentreRank = (place: BtcMapPlace, region: Region): number => {
  const dLat = place.latitude - region.latitude
  const dLng =
    (place.longitude - region.longitude) * Math.cos((region.latitude * Math.PI) / 180)
  return dLat * dLat + dLng * dLng
}

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

    // `getClusters` answers in the index's own spatial order, so slicing it raw
    // would keep an arbitrary 400 and swap which 400 on the next pan — pins
    // blinking in and out, including the one being reached for. Ranked by
    // distance from the middle of the screen instead, the cap degrades where
    // the user is not looking and a small pan changes the set gradually.
    const dropped = Math.max(0, singles.length - MAX_RENDERED)
    if (dropped)
      singles.sort((a, b) => offCentreRank(a, region) - offCentreRank(b, region))

    return {
      places: singles.slice(0, MAX_RENDERED),
      clusters: clusters.slice(0, MAX_RENDERED),
      dropped,
    }
  }, [index, region])

  // Rendering 400 of N reads as a complete map to the user and to anyone
  // chasing a "my shop is missing" report, so the cap says when it bites.
  // Expected, not a defect: a breadcrumb on the next crash, never a non-fatal.
  useEffect(() => {
    if (!visible.dropped) return
    recordAppError(new Error(`BTC Map render cap hit, ${visible.dropped} pins dropped`), {
      expected: true,
      dedupKey: "btcmap-render-cap",
    })
  }, [visible.dropped])

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

      const longitudeDelta = longitudeDeltaForZoom(zoom)
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
