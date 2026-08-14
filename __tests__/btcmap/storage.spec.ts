// The real in-memory mock, not a hand-stubbed pair of methods: the chunking this
// covers leans on multiGet/multiSet/multiRemove behaving like the store does.
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
)

import AsyncStorage from "@react-native-async-storage/async-storage"

import { readSnapshot, writeSnapshot, writeSyncMarkers } from "@app/btcmap/storage"
import { BtcMapPlace } from "@app/btcmap/types"

const place = (id: number): BtcMapPlace => ({
  id,
  latitude: id / 100,
  longitude: id / 50,
  icon: "storefront",
})

const snapshotOf = (count: number) => ({
  places: Array.from({ length: count }, (_, index) => place(index + 1)),
  syncedUpTo: "2026-08-01T00:00:00.000Z",
  lastSyncedAt: "2026-08-02T00:00:00.000Z",
})

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe("btcmap snapshot storage", () => {
  it("round-trips a snapshot", async () => {
    const snapshot = snapshotOf(3)
    await writeSnapshot(snapshot)

    expect(await readSnapshot()).toEqual(snapshot)
  })

  it("reads back nothing when nothing was ever written", async () => {
    expect(await readSnapshot()).toBeNull()
  })

  it("splits large lists across rows to stay under Android's 2 MB row cap", async () => {
    await writeSnapshot(snapshotOf(12_000))

    const keys = await AsyncStorage.getAllKeys()
    const chunkKeys = keys.filter((key) => key.startsWith("btcMapPlacesChunk"))

    expect(chunkKeys).toHaveLength(3)
    expect(await readSnapshot()).toHaveProperty("places.length", 12_000)
  })

  it("clears rows a smaller snapshot no longer needs", async () => {
    await writeSnapshot(snapshotOf(12_000))
    await writeSnapshot(snapshotOf(10))

    const keys = await AsyncStorage.getAllKeys()

    expect(keys.filter((key) => key.startsWith("btcMapPlacesChunk"))).toHaveLength(1)
    expect(await readSnapshot()).toHaveProperty("places.length", 10)
  })

  it("reports a torn snapshot as no snapshot rather than half a map", async () => {
    await writeSnapshot(snapshotOf(12_000))
    await AsyncStorage.removeItem("btcMapPlacesChunk1")

    expect(await readSnapshot()).toBeNull()
  })

  it("ignores a cache written by an older, differently shaped version", async () => {
    await AsyncStorage.setItem(
      "btcMapPlacesMeta",
      JSON.stringify({
        version: 0,
        syncedUpTo: "2026-08-01T00:00:00.000Z",
        lastSyncedAt: "2026-08-02T00:00:00.000Z",
        chunkCount: 1,
      }),
    )

    expect(await readSnapshot()).toBeNull()
  })

  it("records a no-op sync without disturbing the places", async () => {
    // Most hourly syncs change nothing; dropping chunkCount here would read
    // back as "no cache" and force a full re-download on every launch.
    await writeSnapshot(snapshotOf(12_000))

    await writeSyncMarkers({
      syncedUpTo: "2026-09-01T00:00:00.000Z",
      lastSyncedAt: "2026-09-02T00:00:00.000Z",
    })

    expect(await readSnapshot()).toEqual({
      places: snapshotOf(12_000).places,
      syncedUpTo: "2026-09-01T00:00:00.000Z",
      lastSyncedAt: "2026-09-02T00:00:00.000Z",
    })
  })

  it("does not invent a meta row when there is no snapshot to mark", async () => {
    await writeSyncMarkers({
      syncedUpTo: "2026-09-01T00:00:00.000Z",
      lastSyncedAt: "2026-09-02T00:00:00.000Z",
    })

    expect(await readSnapshot()).toBeNull()
  })

  it("reclaims chunks orphaned by a write whose meta never landed", async () => {
    await writeSnapshot(snapshotOf(12_000))
    await AsyncStorage.removeItem("btcMapPlacesMeta")

    await writeSnapshot(snapshotOf(10))

    const keys = await AsyncStorage.getAllKeys()
    expect(keys.filter((key) => key.startsWith("btcMapPlacesChunk"))).toHaveLength(1)
  })

  it("survives a corrupt meta row", async () => {
    await AsyncStorage.setItem("btcMapPlacesMeta", "{not json")

    expect(await readSnapshot()).toBeNull()
  })
})
