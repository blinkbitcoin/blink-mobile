import { Region } from "react-native-maps"

import { MapMarker } from "@app/graphql/generated"

const BTC_MAP_API_URL = "https://api.btcmap.org/v4/places/search/"
const BTC_MAP_PLACE_URL = "https://btcmap.org/merchant"
const KM_PER_LATITUDE_DEGREE = 111.32
const MIN_RADIUS_KM = 2
const MAX_RADIUS_KM = 100

export type BtcMapPlace = {
  id?: number
  lat?: number
  lon?: number
  name?: string | null
  address?: string | null
  website?: string | null
  osm_id?: string | null
  verified_at?: string | null
}

export type BtcMapMarker = {
  source: "btcmap"
  id: string
  btcMapId: number
  btcMapUrl: string
  address?: string
  website?: string
  osmId?: string
  verifiedAt?: string
  mapInfo: {
    title: string
    coordinates: {
      latitude: number
      longitude: number
    }
  }
}

export type MerchantMapMarker = MapMarker | BtcMapMarker

export const isBtcMapMarker = (marker: MerchantMapMarker): marker is BtcMapMarker =>
  "source" in marker && marker.source === "btcmap"

export const getMarkerKey = (marker: MerchantMapMarker): string =>
  isBtcMapMarker(marker) ? marker.id : marker.username

const cleanOptionalString = (value?: string | null) => {
  const cleaned = value?.trim()
  return cleaned ? cleaned : undefined
}

const coordinatesKey = (marker: MerchantMapMarker) => {
  const { latitude, longitude } = marker.mapInfo.coordinates
  return `${latitude.toFixed(5)}:${longitude.toFixed(5)}`
}

export const calculateBtcMapRadiusKm = (region: Region) => {
  const latitudeRadians = (Math.min(Math.abs(region.latitude), 85) * Math.PI) / 180
  const halfLatitudeKm = (region.latitudeDelta * KM_PER_LATITUDE_DEGREE) / 2
  const halfLongitudeKm =
    (region.longitudeDelta * KM_PER_LATITUDE_DEGREE * Math.cos(latitudeRadians)) / 2
  const viewportRadiusKm = Math.sqrt(
    halfLatitudeKm * halfLatitudeKm + halfLongitudeKm * halfLongitudeKm,
  )

  return Math.min(Math.max(viewportRadiusKm, MIN_RADIUS_KM), MAX_RADIUS_KM)
}

export const btcMapSearchUrlForRegion = (region: Region) => {
  const radiusKm = calculateBtcMapRadiusKm(region).toFixed(1)
  return `${BTC_MAP_API_URL}?lat=${region.latitude.toFixed(
    6,
  )}&lon=${region.longitude.toFixed(6)}&radius_km=${radiusKm}`
}

export const btcMapPlaceToMarker = (place: BtcMapPlace): BtcMapMarker | undefined => {
  if (
    !Number.isFinite(place.id) ||
    !Number.isFinite(place.lat) ||
    !Number.isFinite(place.lon)
  ) {
    return undefined
  }

  const btcMapId = place.id as number
  const title = cleanOptionalString(place.name) ?? "BTC Map place"

  return {
    source: "btcmap",
    id: `btcmap:${btcMapId}`,
    btcMapId,
    btcMapUrl: `${BTC_MAP_PLACE_URL}/${btcMapId}`,
    address: cleanOptionalString(place.address),
    website: cleanOptionalString(place.website),
    osmId: cleanOptionalString(place.osm_id),
    verifiedAt: cleanOptionalString(place.verified_at),
    mapInfo: {
      title,
      coordinates: {
        latitude: place.lat as number,
        longitude: place.lon as number,
      },
    },
  }
}

export const fetchBtcMapMarkers = async (region: Region): Promise<BtcMapMarker[]> => {
  const response = await fetch(btcMapSearchUrlForRegion(region), {
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error("Unable to load BTC Map places")
  }

  const places = (await response.json()) as unknown
  if (!Array.isArray(places)) {
    throw new Error("Unexpected BTC Map response")
  }

  return places
    .map((place) => btcMapPlaceToMarker(place as BtcMapPlace))
    .filter((marker): marker is BtcMapMarker => Boolean(marker))
}

export const mergeMapMarkers = (
  blinkMarkers: readonly MapMarker[],
  btcMapMarkers: readonly BtcMapMarker[],
): MerchantMapMarker[] => {
  const blinkCoordinates = new Set(blinkMarkers.map(coordinatesKey))

  return [
    ...blinkMarkers,
    ...btcMapMarkers.filter((marker) => !blinkCoordinates.has(coordinatesKey(marker))),
  ]
}
