import axios from "axios"
import AsyncStorage from "@react-native-async-storage/async-storage"

const btcmapAxios = axios.create({ timeout: 30000 })
import { useState, useEffect } from "react"

import { categories } from "../categories"
import type { BasePlacesData, CdnPlace, Place } from "../map-types"
import {
  MILLISECONDS_IN_MINUTE,
  BTCMAP_V4_API_BASE,
  BTCMAP_V4_PLACES_CDN,
} from "@app/config"
import { useI18nContext } from "@app/i18n/i18n-react.tsx"

const LIMIT = 5000
// AsyncStorage on Android uses SQLite with a 2MB CursorWindow limit per row.
// We chunk the places array to stay well under that limit.
const CHUNK_SIZE = 5000
const STORAGE_META_KEY = "btcmap_places_v4_meta"
const STORAGE_CHUNK_KEY = (i: number) => `btcmap_places_v4_chunk_${i}`

const savePlaces = async (data: BasePlacesData): Promise<void> => {
  const chunks: Place[][] = []
  for (let i = 0; i < data.baseData.length; i += CHUNK_SIZE) {
    chunks.push(data.baseData.slice(i, i + CHUNK_SIZE))
  }

  const oldMetaStr = await AsyncStorage.getItem(STORAGE_META_KEY)
  const oldChunkCount: number = oldMetaStr ? JSON.parse(oldMetaStr).chunkCount ?? 0 : 0

  await AsyncStorage.setItem(
    STORAGE_META_KEY,
    JSON.stringify({ lastUpdated: data.lastUpdated, chunkCount: chunks.length }),
  )
  await AsyncStorage.multiSet(
    chunks.map((chunk, i) => [STORAGE_CHUNK_KEY(i), JSON.stringify(chunk)]),
  )

  // Remove stale chunks from a previous save that had more chunks
  if (oldChunkCount > chunks.length) {
    const staleKeys = Array.from(
      { length: oldChunkCount - chunks.length },
      (_, i) => STORAGE_CHUNK_KEY(chunks.length + i),
    )
    await AsyncStorage.multiRemove(staleKeys)
  }
}

const loadPlaces = async (): Promise<BasePlacesData | null> => {
  const metaStr = await AsyncStorage.getItem(STORAGE_META_KEY)
  if (!metaStr) {
    // Migrate from old single-key format if present
    const legacy = await AsyncStorage.getItem("btcmap_places_v4")
    if (legacy) {
      const data: BasePlacesData = JSON.parse(legacy)
      await savePlaces(data)
      await AsyncStorage.removeItem("btcmap_places_v4")
      return data
    }
    return null
  }

  const meta: { lastUpdated: string; chunkCount: number } = JSON.parse(metaStr)
  const keys = Array.from({ length: meta.chunkCount }, (_, i) => STORAGE_CHUNK_KEY(i))
  const pairs = await AsyncStorage.multiGet(keys)
  const baseData: Place[] = pairs.flatMap(([, value]) =>
    value ? (JSON.parse(value) as Place[]) : [],
  )

  return { lastUpdated: meta.lastUpdated, baseData }
}

export const usePlacesData = () => {
  const [error, setError] = useState<string | null>(null)
  const [places, setPlaces] = useState<BasePlacesData | null>(null)
  const [isLoading, setLoading] = useState<boolean>(false)

  const { LL } = useI18nContext()
  useEffect(() => {
    const fetchAndUpdate = async () => {
      try {
        setLoading(true)
        console.log("[btcmap] fetchAndUpdate started")

        let currentData = await loadPlaces()
        console.log("[btcmap] cache:", currentData ? `${currentData.baseData.length} places` : "empty")

        if (!currentData) {
          console.log("[btcmap] no cache, fetching from CDN...")
          const { data, needsNameEnrichment } = await initializeBasePlaces()
          console.log("[btcmap] CDN done, got", data.baseData.length, "places")
          currentData = data

          if (needsNameEnrichment) {
            console.log("[btcmap] enriching names...")
            await enrichPlacesWithNames(currentData)
          }

          normalize(currentData)
          await savePlaces(currentData)
        }

        console.log("[btcmap] setPlaces with", currentData.baseData.length, "items")
        setPlaces(currentData)

        const timeSinceLastUpdate =
          Date.now() - new Date(currentData.lastUpdated).getTime()
        if (timeSinceLastUpdate <= 5 * MILLISECONDS_IN_MINUTE) {
          return
        }

        const newPlaces = (await fetchPlacesFromApi(
          currentData.lastUpdated,
          true,
        )) as Place[]

        if (!newPlaces.length) {
          return
        }

        const newPlacesIds = new Set(newPlaces.map((place) => place.id))
        const oldFiltered = currentData.baseData.filter(
          (p) => !newPlacesIds.has(p.id),
        )
        const newFiltered = newPlaces.filter((place) => !place.deleted_at)

        const updatedData: BasePlacesData = {
          lastUpdated: new Date().toISOString(),
          baseData: [...oldFiltered, ...newFiltered],
        }

        normalize(updatedData)
        await savePlaces(updatedData)
        setPlaces(updatedData)
      } catch (err: any) {
        console.warn("[btcmap] fetchAndUpdate failed:", err?.message)
        if (err?.response) {
          console.warn("[btcmap] response status:", err.response.status)
        } else if (err?.request) {
          console.warn("[btcmap] no response received - request was made but no answer")
          console.warn("[btcmap] request URL:", err.config?.url)
        } else {
          console.warn("[btcmap] error setting up request:", err?.message)
        }
        setError(LL.MapScreen.btcmapErrors.sync())
      } finally {
        setLoading(false)
      }
    }

    fetchAndUpdate()
  }, [])

  return { places, error, isLoading }
}

const fetchPlacesFromApi = async (
  updatedSince: string = "1970-01-01T00:00:00Z",
  includeAllFields: boolean = false,
): Promise<Place[] | Omit<Place, "lat" | "lon" | "icon">[]> => {
  const allPlaces = includeAllFields
    ? ([] as Place[])
    : ([] as Omit<Place, "lat" | "lon" | "icon">[])

  let currentUpdatedSince = updatedSince

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const fields = includeAllFields
      ? "id,lat,lon,name,updated_at,icon,deleted_at,verified_at,email"
      : "id,name,updated_at,icon,deleted_at,verified_at,email"

    const { data } = await btcmapAxios.get<Place[] | Omit<Place, "lat" | "lon" | "icon">[]>(
      `${BTCMAP_V4_API_BASE}/places?updated_since=${currentUpdatedSince}&limit=${LIMIT}&fields=${fields}&include_deleted=true`,
    )

    if (!data.length) break

    allPlaces.push(...data)

    const lastItem = data[data.length - 1]
    if (!lastItem || !lastItem.updated_at || data.length < LIMIT) {
      break
    }

    currentUpdatedSince = lastItem.updated_at
  }

  return allPlaces
}

const initializeBasePlaces = async (): Promise<{
  data: BasePlacesData
  needsNameEnrichment: boolean
}> => {
  try {
    const cdnData = await btcmapAxios.get<CdnPlace[]>(BTCMAP_V4_PLACES_CDN)
    const headers = cdnData.headers
    const lastUpdatedRaw =
      headers["last-modified"] || headers["Last-Modified"] || headers["Last Modified"]
    const lastUpdated = new Date(lastUpdatedRaw).toISOString()

    return {
      data: { baseData: cdnData.data, lastUpdated },
      needsNameEnrichment: true,
    }
  } catch (error) {
    console.warn("[btcmap] CDN fetch failed, falling back to API:", error)
    const places = (await fetchPlacesFromApi("1970-01-01T00:00:00Z", true)) as Place[]
    const placesFiltered = places.filter((place) => !place.deleted_at)
    return {
      data: {
        baseData: placesFiltered,
        lastUpdated: new Date().toISOString(),
      },
      needsNameEnrichment: false,
    }
  }
}

const enrichPlacesWithNames = async (places: BasePlacesData): Promise<void> => {
  const namesData = (await fetchPlacesFromApi("1970-01-01T00:00:00Z", false)) as Omit<
    Place,
    "lat" | "lon" | "icon"
  >[]

  const placeById = new Map(places.baseData.map((p) => [p.id, p]))
  for (const nameData of namesData) {
    const place = placeById.get(nameData.id)
    if (place) {
      place.name = nameData.name
    }
  }
}

const normalize = (apiData: BasePlacesData): void => {
  apiData.baseData.forEach((place) => {
    place.icon = place.icon.replace(/_/g, "-")
    place.category = categories[place.icon]
  })
}
