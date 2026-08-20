import { useCallback, useEffect, useRef, useState } from "react"

import { recordAppError, toError } from "@app/utils/error-reporting"

import { fetchPlacesNear } from "./api"
import { LatLng, PRIVACY_GRID_SLACK_KM, snapToPrivacyGrid } from "./geo"
import { BtcMapNamedPlace } from "./types"

// The endpoint honours neither `limit` nor `fields`, so the radius is the only
// thing standing between a search and half a megabyte of JSON: ~150 KB over a
// city at 10 km, ~470 KB at 200. Capped at a distance someone might plausibly
// travel to spend bitcoin, which keeps a search over a dense city to a request
// small enough to make on a phone connection.
const MAX_RADIUS_KM = 25

// And a floor, so searching while zoomed into one street still finds the shop
// on the next one over.
const MIN_RADIUS_KM = 5

type State = {
  places: BtcMapNamedPlace[]
  isLoading: boolean
  hasError: boolean
}

const IDLE: State = { places: [], isLoading: false, hasError: false }

const radiusFor = (viewportRadiusKm: number): number =>
  Math.round(
    Math.min(
      MAX_RADIUS_KM,
      Math.max(MIN_RADIUS_KM, viewportRadiusKm + PRIVACY_GRID_SLACK_KM),
    ),
  )

/**
 * The named places around a point, for the search list to filter.
 *
 * Fetched once for the area rather than per keystroke: the endpoint takes no
 * text query, so typing has to filter a list we already hold — which is also why
 * results appear as fast as the letters do, and why a search still works on the
 * flaky connection someone standing in a strange town actually has.
 *
 * `enabled` is what makes this cost nothing until the user opens the search: the
 * map screen mounts for the life of the process, so an unconditional fetch here
 * would be a few hundred KB spent on every app start for a feature most sessions
 * never touch.
 */
export const useBtcMapPlaceSearch = ({
  center,
  viewportRadiusKm,
  enabled,
}: {
  center: LatLng
  viewportRadiusKm: number
  enabled: boolean
}) => {
  const [state, setState] = useState<State>(IDLE)
  const [attempt, setAttempt] = useState(0)

  // Identifies the request so a slow response for an area the user has already
  // left cannot overwrite a newer one.
  const requestRef = useRef(0)

  // The area `state.places` came from, so the next fetch can tell whether it
  // is refreshing that list or replacing it.
  const loadedAreaRef = useRef<string | null>(null)

  // Snapped before it reaches the dependency array, so nudging the map neither
  // re-runs the fetch mid-search nor tells BTC Map that the map was nudged.
  // Reopening the search does ask again — `enabled` re-runs the effect — but
  // for the same snapped area as before. See `snapToPrivacyGrid`.
  const { latitude, longitude } = snapToPrivacyGrid(center)
  const radiusKm = radiusFor(viewportRadiusKm)

  useEffect(() => {
    if (!enabled) return

    requestRef.current += 1
    const request = requestRef.current
    const areaKey = `${latitude},${longitude},${radiusKm}`

    const load = async () => {
      // Keeps what is already listed on screen while the same area refreshes,
      // so re-opening the search does not blink through an empty list. Another
      // area's places are cleared instead: left standing they stay pressable,
      // and tapping one flies the map back to wherever was searched last.
      setState((previous) => ({
        places: loadedAreaRef.current === areaKey ? previous.places : [],
        isLoading: true,
        hasError: false,
      }))

      try {
        const places = await fetchPlacesNear({ latitude, longitude }, radiusKm)
        if (requestRef.current !== request) return
        loadedAreaRef.current = areaKey
        setState({ places, isLoading: false, hasError: false })
      } catch (error) {
        recordAppError(toError(error), { dedupKey: "btcmap-place-search" })
        if (requestRef.current !== request) return
        // Cleared rather than left standing: results from another area, listed
        // under a failure the user is being asked to retry, are worse than none.
        loadedAreaRef.current = null
        setState({ places: [], isLoading: false, hasError: true })
      }
    }

    load()
  }, [enabled, latitude, longitude, radiusKm, attempt])

  const retry = useCallback(() => setAttempt((previous) => previous + 1), [])

  return { ...state, retry }
}
