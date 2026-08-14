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

  it("zooms a tapped cluster to where it breaks apart, keeping the aspect ratio", () => {
    const wide: Region = { ...WORLD, latitudeDelta: 60, longitudeDelta: 120 }
    const { result } = renderHook(() => usePlaceClusters(KNOT, wide))

    const target = result.current.regionForCluster(result.current.clusters[0], wide)

    expect(target.latitude).toBeCloseTo(result.current.clusters[0].latitude, 4)
    expect(target.longitudeDelta).toBeLessThan(wide.longitudeDelta)
    expect(target.latitudeDelta / target.longitudeDelta).toBeCloseTo(0.5, 5)
  })
})
