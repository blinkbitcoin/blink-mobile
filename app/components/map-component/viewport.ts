import { Dimensions } from "react-native"
import { Region } from "react-native-maps"

// Tiles are 256dp wide, so a viewport of W dp at zoom z spans
// 360 * W / (256 * 2^z) degrees of longitude.
const TILE_SIZE = 256
const KM_PER_DEGREE = 111.32
const MAX_ZOOM = 20

const viewportWidth = () => Dimensions.get("window").width

/** The tile zoom at which the map is currently drawn. */
export const zoomForRegion = (region: Region): number => {
  const span = Math.max(region.longitudeDelta, 1e-6)
  const zoom = Math.log2((360 * viewportWidth()) / (TILE_SIZE * span))
  return Math.max(0, Math.min(MAX_ZOOM, Math.round(zoom)))
}

/** How wide a viewport is at a given zoom, for flying to a target. */
export const longitudeDeltaForZoom = (zoom: number): number =>
  (360 * viewportWidth()) / (TILE_SIZE * 2 ** zoom)

/**
 * A radius that covers the whole viewport — its half-diagonal, so the corners
 * are inside it rather than just the edges.
 */
export const radiusKmForRegion = (region: Region): number => {
  const latitudeKm = region.latitudeDelta * KM_PER_DEGREE
  const longitudeKm =
    region.longitudeDelta * KM_PER_DEGREE * Math.cos((region.latitude * Math.PI) / 180)

  return Math.sqrt(latitudeKm ** 2 + longitudeKm ** 2) / 2
}

export { MAX_ZOOM }
