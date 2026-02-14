import axios from "axios"
import AsyncStorage from "@react-native-async-storage/async-storage"
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

export const usePlacesData = () => {
  const [error, setError] = useState<string | null>(null)
  const [places, setPlaces] = useState<BasePlacesData | null>(null)
  const [isLoading, setLoading] = useState<boolean>(false)

  const { LL } = useI18nContext()
  useEffect(() => {
    const fetchAndUpdate = async () => {
      try {
        setLoading(true)

        const cachedData = await AsyncStorage.getItem("btcmap_places_v4")
        let currentData: BasePlacesData

        if (cachedData) {
          currentData = JSON.parse(cachedData)
        } else {
          console.log
          const { data, needsNameEnrichment } = await initializeBasePlaces()
          currentData = data

          if (needsNameEnrichment) {
            await enrichPlacesWithNames(currentData)
          }

          normalize(currentData)
          await AsyncStorage.setItem("btcmap_places_v4", JSON.stringify(currentData))
        }

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
        await AsyncStorage.setItem("btcmap_places_v4", JSON.stringify(updatedData))
        setPlaces(updatedData)
      } catch (error) {
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

    const { data } = await axios.get<Place[] | Omit<Place, "lat" | "lon" | "icon">[]>(
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
    const cdnData = await axios.get<CdnPlace[]>(BTCMAP_V4_PLACES_CDN)
    const headers = cdnData.headers
    const lastUpdatedRaw =
      headers["last-modified"] || headers["Last-Modified"] || headers["Last Modified"]
    const lastUpdated = new Date(lastUpdatedRaw).toISOString()

    return {
      data: { baseData: cdnData.data, lastUpdated },
      needsNameEnrichment: true,
    }
  } catch (error) {
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
