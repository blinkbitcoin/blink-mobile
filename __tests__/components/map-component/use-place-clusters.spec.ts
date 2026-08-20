import { Dimensions } from "react-native"
import { renderHook } from "@testing-library/react-native"
import { Region } from "react-native-maps"

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

  it("zooms a tapped cluster to where it breaks apart, keeping the aspect ratio", () => {
    const wide: Region = { ...WORLD, latitudeDelta: 60, longitudeDelta: 120 }
    const { result } = renderHook(() => usePlaceClusters(KNOT, wide))

    const target = result.current.regionForCluster(result.current.clusters[0], wide)

    expect(target.latitude).toBeCloseTo(result.current.clusters[0].latitude, 4)
    expect(target.longitudeDelta).toBeLessThan(wide.longitudeDelta)
    expect(target.latitudeDelta / target.longitudeDelta).toBeCloseTo(0.5, 5)
  })
})
