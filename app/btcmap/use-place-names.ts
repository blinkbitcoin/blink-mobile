import { useEffect, useRef, useState } from "react"

import { recordAppError, toError } from "@app/utils/error-reporting"

import { fetchPlaceNamesNear } from "./api"
import { LatLng, PRIVACY_GRID_SLACK_KM, snapToPrivacyGrid } from "./geo"

// Panning settles into a burst of region changes; one request per settled view
// is the point, not one per frame.
const DEBOUNCE_MS = 350

// Names are kept while the user pans around a neighbourhood so going back over
// old ground does not blank the labels, but not forever.
const MAX_CACHED_NAMES = 2000

type Viewport = {
  center: LatLng
  radiusKm: number
  // False below the zoom where labels are drawn, so no request is made at all.
  enabled: boolean
}

/**
 * Merchant names for the places currently on screen.
 *
 * The offline snapshot deliberately carries no names, so labels are fetched for
 * the viewport instead — one small request per settled pan onto a new grid cell,
 * and none at all until the map is zoomed in far enough for labels to be drawn.
 *
 * Failures are silent: a missing label is a pin without a name under it, which
 * is exactly what the map looked like before, and not something the user can
 * act on.
 */
export const useBtcMapPlaceNames = (viewport: Viewport): ReadonlyMap<number, string> => {
  const [names, setNames] = useState<ReadonlyMap<number, string>>(new Map())

  // Identifies the request so a slow response for an abandoned viewport cannot
  // overwrite a newer one.
  const requestRef = useRef(0)

  const { enabled } = viewport
  // Quantised before it reaches the dependency array, so a pan that stays
  // inside one cell does not even re-run the effect, let alone re-ask.
  const { latitude, longitude } = snapToPrivacyGrid(viewport.center)
  // Rounded for the same reason, and because a radius carried to fifteen
  // decimal places is a fingerprint of the exact viewport it came from.
  const radiusKm = Math.round((viewport.radiusKm + PRIVACY_GRID_SLACK_KM) * 100) / 100

  useEffect(() => {
    if (!enabled) return undefined

    requestRef.current += 1
    const request = requestRef.current

    const timer = setTimeout(async () => {
      try {
        const fetched = await fetchPlaceNamesNear({ latitude, longitude }, radiusKm)
        if (requestRef.current !== request) return

        setNames((previous) => {
          const merged = new Map(previous)
          for (const [id, name] of fetched) {
            // Deleted first so a name seen again moves to the back of the
            // queue. `Map.set` on a key it already holds keeps the original
            // position, which would evict the names the user keeps returning to
            // ahead of ones glimpsed once and left behind.
            merged.delete(id)
            merged.set(id, name)
          }

          // Least recently seen first, since Map preserves insertion order.
          if (merged.size > MAX_CACHED_NAMES) {
            const excess = merged.size - MAX_CACHED_NAMES
            const stale = Array.from(merged.keys()).slice(0, excess)
            for (const id of stale) merged.delete(id)
          }

          return merged
        })
      } catch (error) {
        recordAppError(toError(error), { dedupKey: "btcmap-place-names" })
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [enabled, latitude, longitude, radiusKm])

  return names
}
