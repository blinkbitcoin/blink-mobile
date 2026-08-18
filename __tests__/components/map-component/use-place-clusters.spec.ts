import { Dimensions } from "react-native"
import { renderHook } from "@testing-library/react-native"
import { Region } from "react-native-maps"
import Supercluster from "supercluster"

import { BtcMapPlace } from "@app/btcmap"
import { usePlaceClusters } from "@app/components/map-component/use-place-clusters"

// A tight knot of places around Bishopsgate, closer together than any cluster
// radius at world zoom and further apart than one at street zoom.
const KNOT: BtcMapPlace[] = Array.from({ length: 40 }, (_, index) => ({
  id: index + 1,
  latitude: 51.5072 + index * 0.0004,
  longitude: -0.1276 + index * 0.0004,
  icon: "storefront",
}))

const region = (latitudeDelta: number): Region => ({
  latitude: 51.5072,
  longitude: -0.1276,
  latitudeDelta,
  longitudeDelta: latitudeDelta,
})

const WORLD = region(120)
const CITY = region(0.4)
const STREET = region(0.0008)

// The same ranking the hook uses to decide what survives the cap.
const rank = (place: BtcMapPlace, view: Region) => {
  const dLat = place.latitude - view.latitude
  const dLng =
    (place.longitude - view.longitude) * Math.cos((view.latitude * Math.PI) / 180)
  return dLat * dLat + dLng * dLng
}

const countClustered = (result: { clusters: { count: number }[] }) =>
  result.clusters.reduce((total, cluster) => total + cluster.count, 0)

describe("usePlaceClusters", () => {
  it("draws nothing before the places have loaded", () => {
    const { result } = renderHook(() => usePlaceClusters([], CITY))

    expect(result.current.places).toEqual([])
    expect(result.current.clusters).toEqual([])
  })

  it("draws nothing before the map has reported a region", () => {
    const { result } = renderHook(() => usePlaceClusters(KNOT, undefined))

    expect(result.current.places).toEqual([])
    expect(result.current.clusters).toEqual([])
  })

  it("folds a crowd into a single disc when zoomed out", () => {
    const { result } = renderHook(() => usePlaceClusters(KNOT, WORLD))

    expect(result.current.clusters).toHaveLength(1)
    expect(result.current.clusters[0].count).toBe(KNOT.length)
    expect(result.current.places).toEqual([])
  })

  it("draws individual pins once they are far enough apart on screen", () => {
    const { result } = renderHook(() => usePlaceClusters(KNOT, STREET))

    expect(result.current.clusters).toEqual([])
    expect(result.current.places.length).toBeGreaterThan(0)
  })

  it("leaves out places outside the viewport", () => {
    const elsewhere: BtcMapPlace = {
      id: 999,
      latitude: -33.8688,
      longitude: 151.2093,
      icon: "hotel",
    }
    const { result } = renderHook(() => usePlaceClusters([...KNOT, elsewhere], CITY))

    const drawn = [
      ...result.current.places.map((place) => place.id),
      ...result.current.clusters.map((cluster) => cluster.count),
    ]
    expect(drawn).not.toContain(999)
  })

  describe("the render cap", () => {
    // Past zoom 16 supercluster stops grouping entirely, so every place in view
    // is its own pin however tightly packed — a dense city centre at street
    // zoom. 600 of them in a block, which is 200 more than the cap allows.
    const SPACING = 0.0000667
    const SCATTERED: BtcMapPlace[] = Array.from({ length: 600 }, (_, index) => ({
      id: index + 1,
      latitude: 51.5072 + (Math.floor(index / 25) - 12) * SPACING,
      longitude: -0.1276 + ((index % 25) - 12) * SPACING,
      icon: "storefront",
    }))
    const OVER = region(0.002)

    beforeEach(() => {
      jest
        .spyOn(Dimensions, "get")
        .mockReturnValue({ width: 384, height: 800, scale: 2, fontScale: 1 })
    })

    afterEach(() => jest.restoreAllMocks())

    it("keeps the pins nearest the middle of the screen", () => {
      const { result } = renderHook(() => usePlaceClusters(SCATTERED, OVER))

      expect(countClustered(result.current)).toBe(0)
      expect(result.current.places).toHaveLength(400)
      expect(result.current.dropped).toBe(200)

      // Whatever survived has to be closer in than everything that did not.
      const kept = new Set(result.current.places.map((place) => place.id))
      const worstKept = Math.max(
        ...result.current.places.map((place) => rank(place, OVER)),
      )
      const bestDropped = Math.min(
        ...SCATTERED.filter((place) => !kept.has(place.id)).map((place) =>
          rank(place, OVER),
        ),
      )
      expect(worstKept).toBeLessThanOrEqual(bestDropped)
    })

    it("changes the set gradually as the map moves, rather than wholesale", () => {
      // The old arbitrary slice swapped which 400 survived on any pan, so pins
      // blinked in and out. A nudge should keep almost all of them.
      const { result, rerender } = renderHook(
        ({ places, view }: { places: BtcMapPlace[]; view: Region }) =>
          usePlaceClusters(places, view),
        { initialProps: { places: SCATTERED, view: OVER } },
      )
      const before = new Set(result.current.places.map((place) => place.id))

      rerender({
        places: SCATTERED,
        view: { ...OVER, latitude: OVER.latitude + SPACING / 6 },
      })
      const after = result.current.places.map((place) => place.id)
      const survivors = after.filter((id) => before.has(id)).length

      expect(after).toHaveLength(400)
      expect(survivors / after.length).toBeGreaterThan(0.9)
    })

    it("reports nothing dropped when everything fits", () => {
      const { result } = renderHook(() => usePlaceClusters(KNOT, STREET))

      expect(result.current.dropped).toBe(0)
    })
  })

  describe("the indexed slice of the world", () => {
    // Indexing is the one expensive thing here — over all ~29k places it took
    // 1.1 s on a slow device, and it happens again every time a category is
    // switched on or off. These pin the scoping that took it to single digits.
    let load: jest.SpyInstance

    // Somewhere far from the knot, so a view over one excludes the other.
    const FARAWAY: BtcMapPlace[] = Array.from({ length: 20 }, (_, index) => ({
      id: 1000 + index,
      latitude: 40.7128 + index * 0.0004,
      longitude: -74.006 + index * 0.0004,
      icon: "hotel",
    }))
    const ALL = [...KNOT, ...FARAWAY]

    const pointsIndexed = () => load.mock.calls.at(-1)?.[0].length

    beforeEach(() => {
      load = jest.spyOn(Supercluster.prototype, "load")
    })

    afterEach(() => jest.restoreAllMocks())

    it("indexes what is around the view, not the whole world", () => {
      renderHook(() => usePlaceClusters(ALL, CITY))

      expect(pointsIndexed()).toBe(KNOT.length)
    })

    it("reuses the index while the map stays inside the slice", () => {
      // The padding exists to buy this: panning must not pay for indexing.
      const { rerender } = renderHook(
        ({ view }: { view: Region }) => usePlaceClusters(ALL, view),
        { initialProps: { view: CITY } },
      )
      expect(load).toHaveBeenCalledTimes(1)

      rerender({ view: { ...CITY, latitude: CITY.latitude + CITY.latitudeDelta / 4 } })

      expect(load).toHaveBeenCalledTimes(1)
    })

    it("rebuilds once the map leaves it", () => {
      const { rerender } = renderHook(
        ({ view }: { view: Region }) => usePlaceClusters(ALL, view),
        { initialProps: { view: CITY } },
      )

      rerender({ view: { ...CITY, latitude: 40.7128, longitude: -74.006 } })

      expect(load).toHaveBeenCalledTimes(2)
      expect(pointsIndexed()).toBe(FARAWAY.length)
    })

    it("rebuilds when the place list changes under it, wherever the map is", () => {
      // This is the filter: same view, fewer places, and the index has to stop
      // reflecting the ones that were switched off.
      const cafes: BtcMapPlace[] = [
        { id: 500, latitude: 51.5074, longitude: -0.1274, icon: "local_cafe" },
        { id: 501, latitude: 51.5076, longitude: -0.1272, icon: "local_cafe" },
      ]
      const { rerender } = renderHook(
        ({ places }: { places: BtcMapPlace[] }) => usePlaceClusters(places, CITY),
        { initialProps: { places: [...ALL, ...cafes] } },
      )
      expect(pointsIndexed()).toBe(KNOT.length + cafes.length)

      rerender({ places: cafes })

      expect(load).toHaveBeenCalledTimes(2)
      expect(pointsIndexed()).toBe(cafes.length)
    })

    it("indexes nothing at all when the filter empties the view", () => {
      // Not a smaller index — no index. Building one over nothing is work spent
      // to draw nothing.
      const { result, rerender } = renderHook(
        ({ places }: { places: BtcMapPlace[] }) => usePlaceClusters(places, CITY),
        { initialProps: { places: ALL } },
      )

      rerender({ places: FARAWAY })

      expect(load).toHaveBeenCalledTimes(1)
      expect(result.current.places).toEqual([])
      expect(result.current.clusters).toEqual([])
    })

    it("keeps both sides of the date line when the slice runs past it", () => {
      // A padded box around Fiji reaches past 180°, where a plain longitude
      // comparison would throw away everything on one side of it.
      const dateline: BtcMapPlace[] = [
        { id: 1, latitude: -17.7, longitude: 179.5, icon: "storefront" },
        { id: 2, latitude: -17.7, longitude: -179.5, icon: "storefront" },
      ]
      const overFiji: Region = {
        latitude: -17.7,
        longitude: 180,
        latitudeDelta: 4,
        longitudeDelta: 4,
      }

      const { result } = renderHook(() => usePlaceClusters(dateline, overFiji))

      expect(pointsIndexed()).toBe(2)
      expect(result.current.places.map((place) => place.id).sort()).toEqual([1, 2])
    })
  })

  it("zooms a tapped cluster to where it breaks apart, keeping the aspect ratio", () => {
    const wide: Region = { ...WORLD, latitudeDelta: 60, longitudeDelta: 120 }
    const { result } = renderHook(() => usePlaceClusters(KNOT, wide))

    const target = result.current.regionForCluster(result.current.clusters[0], wide)

    expect(target.latitude).toBeCloseTo(result.current.clusters[0].latitude, 4)
    expect(target.longitudeDelta).toBeLessThan(wide.longitudeDelta)
    expect(target.latitudeDelta / target.longitudeDelta).toBeCloseTo(0.5, 5)
  })
})
