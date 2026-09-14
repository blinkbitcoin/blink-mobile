import { useCallback, useEffect, useMemo, useRef } from "react"
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

// How much wider than the viewport the indexed slice of the world is.
//
// Building the index is the one expensive thing this hook does — 1.1 s over all
// ~29k places on a slow device — and it has to happen again whenever the list
// changes, which is every time a category is switched on or off. Indexing only
// the places that could plausibly come into view instead makes that cost track
// the zoom rather than the size of the world: a couple of hundred points over a
// city, where it is a few milliseconds.
//
// At 3x, the box reaches a full viewport past every edge, so the map can be
// panned a screen in any direction before the index is rebuilt — and the
// rebuild it eventually pays for is a small one. That padding is also what
// keeps the clustering honest: a cluster forms within `radius` (60 px) of its
// members, a small fraction of a screen, so the only clusters that could be
// under-counted for want of a neighbour outside the box are a whole viewport
// off screen by the time they exist.
const SCOPE_PADDING = 3

type PlaceProperties = { place: BtcMapPlace }

type ClusterOrPlace =
  | Supercluster.ClusterFeature<Supercluster.AnyProps>
  | Supercluster.PointFeature<PlaceProperties>

/** West, south, east, north — the order supercluster wants them in. */
type Bounds = [number, number, number, number]

const EMPTY = {
  places: [] as BtcMapPlace[],
  clusters: [] as ClusterMarkerData[],
  dropped: 0,
}

const boundsForRegion = (region: Region, scale = 1): Bounds => [
  region.longitude - (region.longitudeDelta * scale) / 2,
  region.latitude - (region.latitudeDelta * scale) / 2,
  region.longitude + (region.longitudeDelta * scale) / 2,
  region.latitude + (region.latitudeDelta * scale) / 2,
]

const boundsContain = (outer: Bounds, inner: Bounds): boolean =>
  outer[0] <= inner[0] &&
  outer[1] <= inner[1] &&
  outer[2] >= inner[2] &&
  outer[3] >= inner[3]

/**
 * The places inside a box.
 *
 * A padded box can run past ±180°, and a place on the far side of the
 * antimeridian has a longitude that no longer compares against it. Rather than
 * split the box in two, longitude is left unbounded in that case: over-including
 * costs a slightly larger index, where under-including would silently drop
 * every pin on one side of the date line.
 */
const placesWithin = (places: BtcMapPlace[], bounds: Bounds): BtcMapPlace[] => {
  const [west, south, east, north] = bounds
  const wrapped = west < -180 || east > 180

  return places.filter(
    (place) =>
      place.latitude >= south &&
      place.latitude <= north &&
      (wrapped || (place.longitude >= west && place.longitude <= east)),
  )
}

// What the index currently holds, so a pan that stays inside it can reuse it.
type Scope = {
  // The list it was taken from, by identity: a new list — a category switched
  // on, a sync landing — is a new scope however the map is pointed.
  source: BtcMapPlace[]
  bounds: Bounds
  places: BtcMapPlace[]
}

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
 * Building the index is the expensive half, so it is built over the places
 * around the current view rather than all ~29k — see SCOPE_PADDING. Querying it
 * per region change is cheap enough for the JS thread either way.
 */
export const usePlaceClusters = (places: BtcMapPlace[], region: Region | undefined) => {
  // A cache of the last slice indexed, not state: it never holds anything the
  // index does not already reflect, so recomputing it can only reproduce it.
  const scopeRef = useRef<Scope | null>(null)

  const scope = useMemo(() => {
    if (!region) return null

    const cached = scopeRef.current
    if (
      cached &&
      cached.source === places &&
      boundsContain(cached.bounds, boundsForRegion(region))
    ) {
      return cached
    }

    const bounds = boundsForRegion(region, SCOPE_PADDING)
    const next: Scope = { source: places, bounds, places: placesWithin(places, bounds) }
    scopeRef.current = next
    return next
  }, [places, region])

  const index = useMemo(() => {
    if (!scope?.places.length) return null

    const clusterer = new Supercluster<PlaceProperties>(CLUSTER_OPTIONS)
    clusterer.load(
      scope.places.map((place) => ({
        type: "Feature" as const,
        properties: { place },
        geometry: {
          type: "Point" as const,
          coordinates: [place.longitude, place.latitude],
        },
      })),
    )
    return clusterer
  }, [scope])

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
