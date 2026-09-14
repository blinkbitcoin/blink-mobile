import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

import { useRemoteConfig } from "@app/config/feature-flags-context"
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
 * A clock that was ahead when the cache was written leaves a negative age;
 * without the lower bound the sync would never run again.
 */
const isStale = (snapshot: BtcMapSnapshot | null): boolean => {
  if (!snapshot) return true
  const age = Date.now() - new Date(snapshot.lastSyncedAt).getTime()
  return age >= BTCMAP_SYNC_INTERVAL_MS || age < 0
}

/**
 * The BTC Map place list, held offline.
 *
 * The cached copy is shown the moment it is read, then refreshed in the
 * background — a stale map beats a spinner, and the map is only ever a few
 * edits behind. A cold start pulls the CDN snapshot; every start after that
 * asks the API for what changed, at most once an hour.
 *
 * The map tab stays mounted for the life of the process, so "once an hour"
 * cannot rely on a remount. `refresh` re-runs the age check and is wired to app
 * resume here and to screen focus by the map component; it is a no-op when the
 * cache is fresh or a load is already in flight, so neither trigger can stampede.
 *
 * All of it is behind a Remote Config kill switch, because the data is a third
 * party's: turning `btcMapPlacesEnabled` off empties the map — quietly, since a
 * deliberate shutdown is not an error the user can act on — without waiting for
 * an app release.
 */
export const useBtcMapPlaces = () => {
  const [places, setPlaces] = useState<BtcMapPlace[]>([])
  const [isLoading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const { btcMapPlacesEnabled } = useRemoteConfig()

  const isMountedRef = useRef(true)
  // What `refresh` needs to decide without re-running on every state change.
  const snapshotRef = useRef<BtcMapSnapshot | null>(null)
  const isLoadingRef = useRef(false)
  // Identifies the run of the effect, so a load that was overtaken cannot write
  // its result over a newer one's. `isLoadingRef` keeps `refresh` from starting
  // a second load, but the kill switch flipping is not asking permission.
  const loadRef = useRef(0)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    loadRef.current += 1
    const run = loadRef.current
    const isCurrent = () => loadRef.current === run && isMountedRef.current

    if (!btcMapPlacesEnabled) {
      isLoadingRef.current = false
      // Cleared alongside the state it mirrors. The ref means "the snapshot
      // currently on screen", and leaving a discarded one behind would both
      // have `refresh` weighing staleness against a map nobody is looking at
      // and let a re-enable skip the read that repopulates it.
      snapshotRef.current = null
      setPlaces([])
      setLoading(false)
      setHasError(false)
      return
    }

    const seed = async (): Promise<BtcMapSnapshot> => {
      const { places: seeded, syncedUpTo } = await fetchPlacesSnapshot()
      // Refuse to cache an empty seed — see the read path below.
      if (!seeded.length) throw new Error("BTC Map returned no places")
      if (isCurrent()) setPlaces(seeded)

      const fresh = {
        places: seeded,
        syncedUpTo,
        lastSyncedAt: new Date().toISOString(),
      }

      try {
        await writeSnapshot(fresh)
      } catch (error) {
        // Already drawn: a full disk should cost the next launch a re-download,
        // not this one its map.
        recordAppError(toError(error), { dedupKey: "btcmap-cache-write" })
      }

      return fresh
    }

    const load = async () => {
      isLoadingRef.current = true
      setLoading(true)
      setHasError(false)

      // `refresh` re-runs this effect to re-check the cache's age, not to
      // re-read it: going back to disk would cost a multiGet, a JSON.parse of
      // ~2.4 MB on the JS thread and a fresh array identity that re-clusters
      // all ~29k points, all to arrive at what this ref is already holding.
      let snapshot: BtcMapSnapshot | null = snapshotRef.current

      if (snapshot) {
        // Same array identity, so React bails out when state and ref already
        // agree — and it repairs them when they do not.
        if (isCurrent()) {
          setPlaces(snapshot.places)
          setLoading(false)
        }
      } else {
        try {
          const cached = await readSnapshot()
          // An empty cache is treated as no cache. Otherwise one bad CDN
          // response — a regeneration blip serving [], or a field rename —
          // would be stored as valid and lock the map blank forever, since the
          // re-seed path is only reachable when there is nothing cached at all.
          snapshot = cached?.places.length ? cached : null
          if (snapshot && isCurrent()) {
            setPlaces(snapshot.places)
            setLoading(false)
          }
        } catch (error) {
          // A cache we cannot read is not fatal; fall through to the network.
          recordAppError(toError(error), { dedupKey: "btcmap-cache-read" })
        }
      }

      try {
        if (!snapshot) {
          snapshot = await seed()
        } else if (isStale(snapshot)) {
          const delta = await fetchPlacesDelta(snapshot.syncedUpTo)

          if (delta.needsReseed) {
            // Paging cannot get past this timestamp without stranding rows, so
            // the cache is thrown away rather than left quietly incomplete.
            snapshot = await seed()
          } else {
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
              if (isCurrent()) setPlaces(merged.places)
              snapshot = merged
              await writeSnapshot(merged)
            }
          }
        }
      } catch (error) {
        recordAppError(toError(error), { dedupKey: "btcmap-places-sync" })
        // Only surface a failure the user can see the consequence of. With a
        // cached map on screen, a failed refresh is not worth a toast.
        if (isCurrent() && !snapshot) setHasError(true)
      } finally {
        // A newer run has already replaced this one's state (the kill switch
        // flipped mid-load), so its snapshot is the current one and this stale
        // result must not be written over it.
        if (loadRef.current === run) {
          // The `run` check above is exactly the guard this rule asks for; it
          // just cannot see one written as an early condition rather than a
          // re-read of the ref.
          // eslint-disable-next-line require-atomic-updates
          snapshotRef.current = snapshot
          isLoadingRef.current = false
        }
        if (isCurrent()) setLoading(false)
      }
    }

    load()
  }, [attempt, btcMapPlacesEnabled])

  const refresh = useCallback(() => {
    if (isLoadingRef.current) return
    if (!isStale(snapshotRef.current)) return
    setAttempt((previous) => previous + 1)
  }, [])

  // Coming back from the background is the other way a long-lived map goes
  // stale without ever remounting.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh()
    })
    return () => subscription.remove()
  }, [refresh])

  return { places, isLoading, hasError, refresh }
}
