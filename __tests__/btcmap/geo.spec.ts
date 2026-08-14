import { distanceKm, sharesClockWith } from "@app/btcmap/geo"

const LONDON = { latitude: 51.5072, longitude: -0.1276 }
const BRIGHTON = { latitude: 50.8225, longitude: -0.1372 }
const TOKYO = { latitude: 35.6762, longitude: 139.6503 }

describe("distanceKm", () => {
  it("measures a short hop", () => {
    expect(distanceKm(LONDON, BRIGHTON)).toBeCloseTo(76, 0)
  })

  it("measures a long one", () => {
    expect(distanceKm(LONDON, TOKYO)).toBeCloseTo(9560, -2)
  })

  it("is zero for the same point", () => {
    expect(distanceKm(LONDON, LONDON)).toBe(0)
  })
})

describe("sharesClockWith", () => {
  it("trusts the device clock for a place the user could walk to", () => {
    expect(sharesClockWith(LONDON, BRIGHTON)).toBe(true)
  })

  it("refuses it for a place on the other side of the world", () => {
    expect(sharesClockWith(LONDON, TOKYO)).toBe(false)
  })

  it("refuses it when the user's location is unknown", () => {
    expect(sharesClockWith(undefined, BRIGHTON)).toBe(false)
  })
})
