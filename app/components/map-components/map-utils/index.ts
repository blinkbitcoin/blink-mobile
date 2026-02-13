import MapView, { LatLng, Region } from "react-native-maps"
import { Geometry, Position } from "geojson"

/**
 * Super-slow implementation of ray casting algorithm.
 * It should be replaced by requesting area elements,
 * and comparing currently rendered places with those fetched,
 * but for now, there's no way to do it (since it's not a thing in BTCMap API yet).
 * It can be also optimized by Native C++ TurboModules,
 * once new architecture will be enabled.
 * @param point
 * @param geometry
 */
export function isPointInArea(point: LatLng, geometry: Geometry): boolean {
  const toLatLng = ([lon, lat]: Position) => ({
    latitude: lat,
    longitude: lon,
  })
  const bbox = calculateBounds(geometry)
  if (
    point.longitude > bbox.maxLng ||
    point.longitude < bbox.minLng ||
    point.latitude > bbox.maxLat ||
    point.latitude < bbox.minLat
  ) {
    return false
  }

  switch (geometry.type) {
    case "Polygon":
      return isPointInPolygonWithHoles(
        point,
        geometry.coordinates.map((ring: Position[]) => ring.map(toLatLng)),
      )

    case "MultiPolygon":
      return geometry.coordinates.some((polygon: Position[][]) =>
        isPointInPolygonWithHoles(
          point,
          polygon.map((ring) => ring.map(toLatLng)),
        ),
      )

    case "GeometryCollection":
      return geometry.geometries.some((g: Geometry) => isPointInArea(point, g))

    default:
      return false
  }
}

function isPointInPolygonWithHoles(point: LatLng, rings: LatLng[][]): boolean {
  const [outer, ...holes] = rings
  if (!outer || !isPointInPolygon(point, outer)) return false
  for (const hole of holes) {
    if (isPointInPolygon(point, hole)) return false
  }
  return true
}
function isPointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  const { latitude, longitude } = point
  let isInside = false

  // eslint-disable-next-line no-plusplus
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const vertexI = polygon[i]
    const vertexJ = polygon[j]

    const intersect =
      vertexI.longitude > longitude !== vertexJ.longitude > longitude &&
      latitude <
        ((vertexJ.latitude - vertexI.latitude) * (longitude - vertexI.longitude)) /
          (vertexJ.longitude - vertexI.longitude) +
          vertexI.latitude

    if (intersect) {
      isInside = !isInside
    }
  }

  return isInside
}

// eslint-disable-next-line max-params
export function navigateToGeometry(
  mapRef: React.RefObject<MapView>,
  geometry: Geometry,
  padding: number = 0.1,
  duration: number = 1000,
) {
  if (!mapRef.current) return

  const region = calculateCenterAndRegion(geometry, padding)

  mapRef.current.animateToRegion(region, duration)
}

function calculateBounds(geometry: Geometry): {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
} {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  const processCoordinates = (coords: number[][]) => {
    coords.forEach(([lng, lat]) => {
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
    })
  }

  switch (geometry.type) {
    case "Polygon":
      geometry.coordinates.forEach(processCoordinates)
      break
    case "MultiPolygon":
      geometry.coordinates.forEach((polygon) => polygon.forEach(processCoordinates))
      break
    case "GeometryCollection":
      geometry.geometries.forEach((g) => {
        const bounds = calculateBounds(g)
        minLat = Math.min(minLat, bounds.minLat)
        maxLat = Math.max(maxLat, bounds.maxLat)
        minLng = Math.min(minLng, bounds.minLng)
        maxLng = Math.max(maxLng, bounds.maxLng)
      })
      break
  }

  return { minLat, maxLat, minLng, maxLng }
}

function calculateCenterAndRegion(geometry: Geometry, padding: number = 0.1): Region {
  const bounds = calculateBounds(geometry)

  const centerLatitude = (bounds.minLat + bounds.maxLat) / 2
  const centerLongitude = (bounds.minLng + bounds.maxLng) / 2

  const latitudeDelta = (bounds.maxLat - bounds.minLat) * (1 + padding)
  const longitudeDelta = (bounds.maxLng - bounds.minLng) * (1 + padding)

  return {
    latitude: centerLatitude,
    longitude: centerLongitude,
    latitudeDelta: Math.max(latitudeDelta, 0.01),
    longitudeDelta: Math.max(longitudeDelta, 0.01),
  }
}
