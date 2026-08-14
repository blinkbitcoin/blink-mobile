import { useCallback, useEffect, useRef, useState } from "react"

import { recordAppError, toError } from "@app/utils/error-reporting"

import { fetchPlacesDelta, fetchPlacesSnapshot } from "./api"
import { BTCMAP_SYNC_INTERVAL_MS } from "./config"
import { readSnapshot, writeSnapshot, writeSyncMarkers } from "./storage"
import { BtcMapPlace, BtcMapSnapshot } from "./types"

const applyDelta = (
  snapshot: BtcMapSnapshot,
  delta: Awaited<ReturnType<typeof fetchPlacesDelta>>,
): BtcMapPlace[] => {
  const byId = new Map(snapshot.places.map((place) => [place.id, place]))
  for (const id of delta.removedIds) byId.delete(id)
  for (const place of delta.upserted) byId.set(place.id, place)
  return Array.from(byId.values())
}

/**
 * The BTC Map place list, held offline.
 *
 * The cached copy is shown the moment it is read, then refreshed in the
 * background — a stale map beats a spinner, and the map is only ever a few
 * edits behind. A cold start pulls the CDN snapshot; every start after that
 * asks the API for what changed, at most once an hour.
 */
export const useBtcMapPlaces = () => {
  const [places, setPlaces] = useState<BtcMapPlace[]>([])
  const [isLoading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setHasError(false)

      let snapshot: BtcMapSnapshot | null = null

      try {
        const cached = await readSnapshot()
        // An empty cache is treated as no cache. Otherwise one bad CDN response
        // — a regeneration blip serving [], or a field rename — would be stored
        // as valid and lock the map blank forever, since the re-seed path is
        // only reachable when there is nothing cached at all.
        snapshot = cached?.places.length ? cached : null
        if (snapshot && isMountedRef.current) {
          setPlaces(snapshot.places)
          setLoading(false)
        }
      } catch (error) {
        // A cache we cannot read is not fatal; fall through to the network.
        recordAppError(toError(error), { dedupKey: "btcmap-cache-read" })
      }

      try {
        if (snapshot) {
          // A clock that was ahead when the cache was written leaves a negative
          // age; without the lower bound the sync would never run again.
          const age = Date.now() - new Date(snapshot.lastSyncedAt).getTime()
          if (age >= BTCMAP_SYNC_INTERVAL_MS || age < 0) {
            const delta = await fetchPlacesDelta(snapshot.syncedUpTo)
            const markers = {
              syncedUpTo: delta.syncedUpTo,
              lastSyncedAt: new Date().toISOString(),
            }

            // Most hourly syncs change nothing. Keeping the same array spares
            // the map a full re-cluster of ~29k points and a 2.4 MB rewrite.
            if (!delta.upserted.length && !delta.removedIds.length) {
              snapshot = { ...snapshot, ...markers }
              await writeSyncMarkers(markers)
            } else {
              const merged: BtcMapSnapshot = {
                places: applyDelta(snapshot, delta),
                ...markers,
              }
              // Draw before persisting: a full disk should cost the next launch
              // a re-download, not this one its map.
              if (!isMountedRef.current) return
              setPlaces(merged.places)
              snapshot = merged
              await writeSnapshot(merged)
            }
          }
        } else {
          const { places: seeded, syncedUpTo } = await fetchPlacesSnapshot()
          // Refuse to cache an empty seed — see the read path above.
          if (!seeded.length) throw new Error("BTC Map returned no places")
          if (!isMountedRef.current) return
          setPlaces(seeded)
          snapshot = {
            places: seeded,
            syncedUpTo,
            lastSyncedAt: new Date().toISOString(),
          }
          await writeSnapshot(snapshot)
        }
      } catch (error) {
        recordAppError(toError(error), { dedupKey: "btcmap-places-sync" })
        // Only surface a failure the user can see the consequence of. With a
        // cached map on screen, a failed refresh is not worth a toast.
        if (isMountedRef.current && !snapshot) setHasError(true)
      } finally {
        if (isMountedRef.current) setLoading(false)
      }
    }

    load()
  }, [attempt])

  const retry = useCallback(() => setAttempt((previous) => previous + 1), [])

  return { places, isLoading, hasError, retry }
}
