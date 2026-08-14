import { act, renderHook, waitFor } from "@testing-library/react-native"

import { fetchPlacesDelta, fetchPlacesSnapshot } from "@app/btcmap/api"
import { BTCMAP_SYNC_INTERVAL_MS } from "@app/btcmap/config"
import { readSnapshot, writeSnapshot, writeSyncMarkers } from "@app/btcmap/storage"
import { BtcMapPlace, BtcMapSnapshot } from "@app/btcmap/types"
import { useBtcMapPlaces } from "@app/btcmap/use-places"

jest.mock("@app/btcmap/api", () => ({
  fetchPlacesSnapshot: jest.fn(),
  fetchPlacesDelta: jest.fn(),
}))

const mockRemoteConfig = { btcMapPlacesEnabled: true }
jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockRemoteConfig,
}))

jest.mock("@app/btcmap/storage", () => ({
  readSnapshot: jest.fn(),
  writeSnapshot: jest.fn(),
  writeSyncMarkers: jest.fn(),
}))

const mockedRead = readSnapshot as jest.MockedFunction<typeof readSnapshot>
const mockedWrite = writeSnapshot as jest.MockedFunction<typeof writeSnapshot>
const mockedMarkers = writeSyncMarkers as jest.MockedFunction<typeof writeSyncMarkers>
const mockedSnapshot = fetchPlacesSnapshot as jest.MockedFunction<
  typeof fetchPlacesSnapshot
>
const mockedDelta = fetchPlacesDelta as jest.MockedFunction<typeof fetchPlacesDelta>

const place = (id: number): BtcMapPlace => ({
  id,
  latitude: id,
  longitude: id,
  icon: "storefront",
})

const cached = (ageMs: number): BtcMapSnapshot => ({
  places: [place(1), place(2)],
  syncedUpTo: "2026-08-01T00:00:00.000Z",
  lastSyncedAt: new Date(Date.now() - ageMs).toISOString(),
})

beforeEach(() => {
  jest.clearAllMocks()
  mockRemoteConfig.btcMapPlacesEnabled = true
  mockedWrite.mockResolvedValue(undefined)
  mockedMarkers.mockResolvedValue(undefined)
  mockedDelta.mockResolvedValue({
    upserted: [],
    removedIds: [],
    syncedUpTo: "2026-08-02T00:00:00.000Z",
    needsReseed: false,
  })
})

describe("useBtcMapPlaces", () => {
  it("seeds from the CDN when there is nothing cached", async () => {
    mockedRead.mockResolvedValue(null)
    mockedSnapshot.mockResolvedValue({
      places: [place(1)],
      syncedUpTo: "2026-08-01T00:00:00.000Z",
    })

    const { result } = renderHook(() => useBtcMapPlaces())

    await waitFor(() => expect(result.current.places).toHaveLength(1))
    expect(mockedDelta).not.toHaveBeenCalled()
    expect(mockedWrite).toHaveBeenCalled()
  })

  it("shows the cached map without waiting on the network", async () => {
    mockedRead.mockResolvedValue(cached(0))

    const { result } = renderHook(() => useBtcMapPlaces())

    await waitFor(() => expect(result.current.places).toHaveLength(2))
    expect(mockedSnapshot).not.toHaveBeenCalled()
    expect(mockedDelta).not.toHaveBeenCalled()
  })

  it("asks for a delta once the cache has gone stale", async () => {
    mockedRead.mockResolvedValue(cached(BTCMAP_SYNC_INTERVAL_MS + 1000))
    mockedDelta.mockResolvedValue({
      upserted: [place(3)],
      removedIds: [1],
      syncedUpTo: "2026-08-02T00:00:00.000Z",
      needsReseed: false,
    })

    const { result } = renderHook(() => useBtcMapPlaces())

    await waitFor(() => expect(result.current.places).toHaveLength(2))
    expect(result.current.places.map((entry) => entry.id).sort()).toEqual([2, 3])
    expect(mockedDelta).toHaveBeenCalledWith("2026-08-01T00:00:00.000Z")
  })

  it("keeps a failed refresh to itself while a cached map is on screen", async () => {
    mockedRead.mockResolvedValue(cached(BTCMAP_SYNC_INTERVAL_MS + 1000))
    mockedDelta.mockRejectedValue(new Error("network request failed"))

    const { result } = renderHook(() => useBtcMapPlaces())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.hasError).toBe(false)
    expect(result.current.places).toHaveLength(2)
  })

  it("surfaces a failure the user can see the consequence of", async () => {
    mockedRead.mockResolvedValue(null)
    mockedSnapshot.mockRejectedValue(new Error("network request failed"))

    const { result } = renderHook(() => useBtcMapPlaces())

    await waitFor(() => expect(result.current.hasError).toBe(true))
    expect(result.current.places).toEqual([])
  })

  it("still draws the map when it cannot be cached", async () => {
    // A full disk should cost the next launch a re-download, not this launch
    // its map.
    mockedRead.mockResolvedValue(null)
    mockedSnapshot.mockResolvedValue({
      places: [place(1)],
      syncedUpTo: "2026-08-01T00:00:00.000Z",
    })
    mockedWrite.mockRejectedValue(new Error("database or disk is full"))

    const { result } = renderHook(() => useBtcMapPlaces())

    await waitFor(() => expect(result.current.places).toHaveLength(1))
    expect(result.current.hasError).toBe(false)
  })

  it("falls back to the network when the cache cannot be read", async () => {
    mockedRead.mockRejectedValue(new Error("AsyncStorage unavailable"))
    mockedSnapshot.mockResolvedValue({
      places: [place(1)],
      syncedUpTo: "2026-08-01T00:00:00.000Z",
    })

    const { result } = renderHook(() => useBtcMapPlaces())

    await waitFor(() => expect(result.current.places).toHaveLength(1))
  })

  it("retries on request", async () => {
    mockedRead.mockResolvedValue(null)
    mockedSnapshot.mockRejectedValueOnce(new Error("network request failed"))
    mockedSnapshot.mockResolvedValue({
      places: [place(1)],
      syncedUpTo: "2026-08-01T00:00:00.000Z",
    })

    const { result } = renderHook(() => useBtcMapPlaces())
    await waitFor(() => expect(result.current.hasError).toBe(true))

    act(() => result.current.retry())

    await waitFor(() => expect(result.current.places).toHaveLength(1))
    expect(result.current.hasError).toBe(false)
  })
})

describe("useBtcMapPlaces recovery paths", () => {
  it("re-seeds instead of trusting a cache that came back empty", async () => {
    // A CDN blip that served [] must not be able to pin the map blank forever.
    mockedRead.mockResolvedValue({ ...cached(0), places: [] })
    mockedSnapshot.mockResolvedValue({
      places: [place(1)],
      syncedUpTo: "2026-08-01T00:00:00.000Z",
    })

    const { result } = renderHook(() => useBtcMapPlaces())

    await waitFor(() => expect(result.current.places).toHaveLength(1))
    expect(mockedSnapshot).toHaveBeenCalled()
  })

  it("refuses to cache an empty seed", async () => {
    mockedRead.mockResolvedValue(null)
    mockedSnapshot.mockResolvedValue({
      places: [],
      syncedUpTo: "2026-08-01T00:00:00.000Z",
    })

    const { result } = renderHook(() => useBtcMapPlaces())

    await waitFor(() => expect(result.current.hasError).toBe(true))
    expect(mockedWrite).not.toHaveBeenCalled()
  })

  it("syncs again when the cache was written by a clock running ahead", async () => {
    // Negative age must read as stale, or the sync never runs again.
    mockedRead.mockResolvedValue(cached(-4 * 365 * 24 * 60 * 60 * 1000))

    renderHook(() => useBtcMapPlaces())

    await waitFor(() => expect(mockedDelta).toHaveBeenCalled())
  })

  it("keeps the same place list when a sync changes nothing", async () => {
    mockedRead.mockResolvedValue(cached(BTCMAP_SYNC_INTERVAL_MS + 1000))

    const { result } = renderHook(() => useBtcMapPlaces())
    await waitFor(() => expect(result.current.places).toHaveLength(2))
    const first = result.current.places

    await waitFor(() => expect(mockedMarkers).toHaveBeenCalled())

    // Same array identity, so the 29k-point cluster index is not rebuilt and
    // 2.4 MB of chunks are not rewritten for zero changed rows.
    expect(result.current.places).toBe(first)
    expect(mockedWrite).not.toHaveBeenCalled()
  })
})

describe("useBtcMapPlaces kill switch", () => {
  it("touches neither cache nor network while the feed is switched off", async () => {
    // The data is a third party's; turning it off has to work without a release.
    mockRemoteConfig.btcMapPlacesEnabled = false
    mockedRead.mockResolvedValue(cached(0))

    const { result } = renderHook(() => useBtcMapPlaces())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.places).toEqual([])
    expect(mockedRead).not.toHaveBeenCalled()
    expect(mockedSnapshot).not.toHaveBeenCalled()
    expect(mockedDelta).not.toHaveBeenCalled()
  })

  it("empties the map quietly rather than reporting an error", async () => {
    mockRemoteConfig.btcMapPlacesEnabled = false

    const { result } = renderHook(() => useBtcMapPlaces())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.hasError).toBe(false)
  })
})

describe("useBtcMapPlaces lossless sync", () => {
  it("throws the cache away when the delta cannot page losslessly", async () => {
    mockedRead.mockResolvedValue(cached(BTCMAP_SYNC_INTERVAL_MS + 1000))
    mockedDelta.mockResolvedValue({
      upserted: [],
      removedIds: [],
      syncedUpTo: "2026-08-01T00:00:00.000Z",
      needsReseed: true,
    })
    mockedSnapshot.mockResolvedValue({
      places: [place(7), place(8)],
      syncedUpTo: "2026-08-05T00:00:00.000Z",
    })

    const { result } = renderHook(() => useBtcMapPlaces())

    await waitFor(() =>
      expect(result.current.places.map((entry) => entry.id)).toEqual([7, 8]),
    )
    expect(mockedSnapshot).toHaveBeenCalled()
    expect(mockedWrite).toHaveBeenCalled()
  })
})
