import {
  displayDistance,
  distanceKm,
  sharesClockWith,
  snapToPrivacyGrid,
} from "@app/btcmap/geo"

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

describe("snapToPrivacyGrid", () => {
  it("rounds a position to the cell it falls in", () => {
    expect(snapToPrivacyGrid({ latitude: 51.50312, longitude: -0.12417 })).toEqual({
      latitude: 51.5,
      longitude: -0.12,
    })
  })

  it("gives neighbouring positions the same answer", () => {
    // This is what stops a series of requests from tracing the path someone
    // took through a neighbourhood: every look around it asks one question.
    expect(snapToPrivacyGrid({ latitude: 51.49866, longitude: -0.11983 })).toEqual(
      snapToPrivacyGrid({ latitude: 51.50312, longitude: -0.12417 }),
    )
  })
})

describe("displayDistance", () => {
  it("counts the last few hundred metres in metres", () => {
    expect(displayDistance(0.2)).toEqual({ unit: "m", value: 200 })
  })

  it("switches to kilometres once metres stop being easy to picture", () => {
    expect(displayDistance(0.6)).toEqual({ unit: "km", value: 0.6 })
    expect(displayDistance(1.14)).toEqual({ unit: "km", value: 1.1 })
  })

  it("drops the decimal once it is noise", () => {
    expect(displayDistance(23.4)).toEqual({ unit: "km", value: 23 })
  })

  it("rounds metres to something a walk can be measured to", () => {
    // Neither the survey nor the phone's own fix is good to the metre, so
    // printing that digit would claim a precision we do not have.
    expect(displayDistance(0.2073)).toEqual({ unit: "m", value: 210 })
  })

  it("never reports a negative distance", () => {
    expect(displayDistance(-1)).toEqual({ unit: "m", value: 0 })
  })
})
