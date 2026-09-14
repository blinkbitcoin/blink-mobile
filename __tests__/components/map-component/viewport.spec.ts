import { Dimensions } from "react-native"
import { Region } from "react-native-maps"

import {
  MAX_ZOOM,
  longitudeDeltaForZoom,
  radiusKmForRegion,
  zoomForRegion,
} from "@app/components/map-component/viewport"

// Every function here is derived from the viewport's width in dp, so it is
// pinned rather than left to whatever the test renderer reports.
const WIDTH = 384

beforeEach(() => {
  jest
    .spyOn(Dimensions, "get")
    .mockReturnValue({ width: WIDTH, height: 800, scale: 2, fontScale: 1 })
})

afterEach(() => jest.restoreAllMocks())

const region = (overrides: Partial<Region> = {}): Region => ({
  latitude: 51.5072,
  longitude: -0.1276,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
  ...overrides,
})

describe("zoomForRegion", () => {
  it("reads a whole-world viewport as the zoom that fits it", () => {
    // 384 dp of a 256 dp tile is 1.5 tiles, so the world fits at just past 0.
    expect(zoomForRegion(region({ longitudeDelta: 360 }))).toBe(1)
  })

  it("gains a level for every halving of the span", () => {
    const wide = zoomForRegion(region({ longitudeDelta: 0.08 }))
    expect(zoomForRegion(region({ longitudeDelta: 0.04 }))).toBe(wide + 1)
    expect(zoomForRegion(region({ longitudeDelta: 0.02 }))).toBe(wide + 2)
  })

  it("clamps rather than running off either end", () => {
    // A region delta of 0 is what the map reports before it has laid out.
    expect(zoomForRegion(region({ longitudeDelta: 0 }))).toBe(MAX_ZOOM)
    expect(zoomForRegion(region({ longitudeDelta: 1e-12 }))).toBe(MAX_ZOOM)
    expect(zoomForRegion(region({ longitudeDelta: 100000 }))).toBe(0)
  })

  it("round-trips against longitudeDeltaForZoom", () => {
    for (const zoom of [4, 10, 15, 17]) {
      expect(zoomForRegion(region({ longitudeDelta: longitudeDeltaForZoom(zoom) }))).toBe(
        zoom,
      )
    }
  })
})

describe("radiusKmForRegion", () => {
  it("covers the corners of the viewport, not just its edges", () => {
    const square = region({ latitudeDelta: 0.02, longitudeDelta: 0.02 })
    const halfHeightKm = (0.02 * 111.32) / 2

    // The half-diagonal is longer than the half-edge, which is the point.
    expect(radiusKmForRegion(square)).toBeGreaterThan(halfHeightKm)
  })

  it("narrows the longitude span as latitude rises", () => {
    const shape = { latitudeDelta: 0.02, longitudeDelta: 0.02 }
    const equator = radiusKmForRegion(region({ ...shape, latitude: 0 }))
    const london = radiusKmForRegion(region({ ...shape, latitude: 51.5 }))
    const svalbard = radiusKmForRegion(region({ ...shape, latitude: 78 }))

    // A degree of longitude shrinks toward the poles; a degree of latitude does
    // not, so the radius falls but never below the latitude half-span.
    expect(london).toBeLessThan(equator)
    expect(svalbard).toBeLessThan(london)
    expect(svalbard).toBeGreaterThan((0.02 * 111.32) / 2)
  })

  it("gives a sane number for the viewport labels are actually drawn at", () => {
    // Zoom 15 over London is a few streets — a sub-kilometre ask, which is what
    // keeps the name request small.
    const atZoom15 = region({
      longitudeDelta: longitudeDeltaForZoom(15),
      latitudeDelta: longitudeDeltaForZoom(15) * (800 / WIDTH),
    })

    expect(radiusKmForRegion(atZoom15)).toBeGreaterThan(0)
    expect(radiusKmForRegion(atZoom15)).toBeLessThan(2)
  })
})
