import { BtcMapPlace } from "@app/btcmap"
import {
  Box,
  boxesIntersect,
  estimateLabelWidth,
  labelBox,
  placeLabels,
  projectToScreen,
} from "@app/components/map-component/label-collision"
import {
  LABEL_ELLIPSIS,
  LABEL_MAX_CHARACTERS,
  LABEL_MAX_WIDTH,
  LABEL_OFFSET_X,
  LABEL_OFFSET_Y,
  truncateLabel,
} from "@app/components/map-component/marker-layout"

// A phone-shaped map view. Nothing here reads Dimensions — the placement is
// given the size of the view it is placing into, so the size is a fixture.
const VIEWPORT = { width: 384, height: 720 }

// Berlín, El Salvador: the town from the report, where the pins are packed
// tightly enough that every name overlapped its neighbours.
const BERLIN_SV = {
  latitude: 13.4956,
  longitude: -88.5333,
  latitudeDelta: 0.006,
  longitudeDelta: 0.006,
}

const OVER_BERLIN = { region: BERLIN_SV, viewport: VIEWPORT }

const place = (id: number, latitude: number, longitude: number): BtcMapPlace => ({
  id,
  latitude,
  longitude,
  icon: "storefront",
})

const named = (places: BtcMapPlace[], name = "Pupusería Victoria") =>
  new Map(places.map((p) => [p.id, name]))

describe("projectToScreen", () => {
  it("puts the region's centre in the middle of the view", () => {
    const { x, y } = projectToScreen(BERLIN_SV, OVER_BERLIN)

    expect(x).toBeCloseTo(VIEWPORT.width / 2, 6)
    // Not exact, and cannot be: `latitudeDelta` is the span between the north
    // and south edges, and Mercator does not put the latitude halfway between
    // them halfway down the screen. The gap is what that curvature is worth
    // across one viewport — 0.002 dp here, and smaller the further in the map
    // is zoomed. Labels only exist from zoom 15, so this is always this small.
    expect(y).toBeCloseTo(VIEWPORT.height / 2, 1)
  })

  it("puts the region's corners on the view's corners", () => {
    const northWest = projectToScreen(
      {
        latitude: BERLIN_SV.latitude + BERLIN_SV.latitudeDelta / 2,
        longitude: BERLIN_SV.longitude - BERLIN_SV.longitudeDelta / 2,
      },
      OVER_BERLIN,
    )

    expect(northWest.x).toBeCloseTo(0, 6)
    expect(northWest.y).toBeCloseTo(0, 6)
  })

  it("grows y downwards, as the screen does and latitude does not", () => {
    const north = projectToScreen(
      { latitude: BERLIN_SV.latitude + 0.002, longitude: BERLIN_SV.longitude },
      OVER_BERLIN,
    )

    expect(north.y).toBeLessThan(VIEWPORT.height / 2)
  })

  it("is Mercator in y, not a straight interpolation of latitude", () => {
    // Far enough north that the two disagree measurably. A linear reading would
    // put the midpoint of the span exactly halfway down the view; Mercator
    // stretches the poleward half, so the midpoint sits below centre.
    const arctic = {
      latitude: 78,
      longitude: 15,
      latitudeDelta: 8,
      longitudeDelta: 8,
    }
    const midpoint = projectToScreen(
      { latitude: arctic.latitude, longitude: arctic.longitude },
      { region: arctic, viewport: VIEWPORT },
    )

    expect(midpoint.y).toBeGreaterThan(VIEWPORT.height / 2 + 1)
  })

  it("keeps a viewport that straddles the antimeridian on screen", () => {
    const dateline = {
      latitude: -16.5,
      longitude: 179.99,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }
    // A place a hundredth of a degree east of the centre, which is past +180
    // and so is written as a negative longitude.
    const across = projectToScreen(
      { latitude: -16.5, longitude: -179.999 },
      { region: dateline, viewport: VIEWPORT },
    )

    expect(across.x).toBeGreaterThan(VIEWPORT.width / 2)
    expect(across.x).toBeLessThan(VIEWPORT.width)
  })
})

describe("estimateLabelWidth", () => {
  it("grows with the number of characters", () => {
    expect(estimateLabelWidth("Chero")).toBeGreaterThan(estimateLabelWidth("El"))
  })

  it("charges narrow characters less than wide ones", () => {
    expect(estimateLabelWidth("lll")).toBeLessThan(estimateLabelWidth("mmm"))
  })

  it("stops at the width the view is allowed to reach", () => {
    // Past this the label ellipsises rather than running on, so the estimate
    // becomes the exact rendered width.
    expect(estimateLabelWidth("m".repeat(200))).toBe(LABEL_MAX_WIDTH)
  })

  it("costs nothing for an empty name", () => {
    expect(estimateLabelWidth("")).toBe(0)
  })
})

describe("truncateLabel", () => {
  it("leaves a name that fits exactly as it is", () => {
    expect(truncateLabel("Tienda Maxim")).toBe("Tienda Maxim")
    expect(truncateLabel("a".repeat(LABEL_MAX_CHARACTERS))).toBe(
      "a".repeat(LABEL_MAX_CHARACTERS),
    )
  })

  it("keeps the budget's worth of characters and marks the rest", () => {
    expect(truncateLabel("Pupusería Victoria")).toBe("Pupusería Victor" + LABEL_ELLIPSIS)
    expect([...truncateLabel("a".repeat(40))]).toHaveLength(LABEL_MAX_CHARACTERS + 1)
  })

  it("does not leave the ellipsis floating a word's gap from the text", () => {
    // The cut lands on the space between "Restaurante" and "Los": keeping it
    // would draw "Restaurante Los …" with a hole before the mark.
    expect(truncateLabel("Restaurante Los Cocos")).toBe(
      "Restaurante Los" + LABEL_ELLIPSIS,
    )
  })

  it("counts code points, so an astral character is never cut in half", () => {
    // Sixteen emoji are sixteen characters to a reader and thirty-two UTF-16
    // units to `.length` — slicing by the latter ends the string on a lone
    // surrogate, which draws as a replacement box.
    const emoji = "☕️".repeat(2) + "🍕".repeat(20)
    const truncated = truncateLabel(emoji)

    expect([...truncated]).toHaveLength(LABEL_MAX_CHARACTERS + 1)
    expect(truncated).not.toMatch(/[\uD800-\uDFFF]$/)
  })

  it("narrows the strip a long name asks the placement for", () => {
    // Which is the whole point of the budget: an unshortened name clamps to the
    // full width the view may reach and reserves it away from its neighbours.
    const long = "l".repeat(60)

    expect(estimateLabelWidth(long)).toBe(LABEL_MAX_WIDTH)
    expect(estimateLabelWidth(truncateLabel(long))).toBeLessThan(LABEL_MAX_WIDTH)
  })

  it("charges the ellipsis rather than letting it run past the estimate", () => {
    // A mark this wide taking the default per-character bucket would put the
    // estimate under the pixels — the one direction this module must not err in.
    const cut = truncateLabel("l".repeat(60))

    expect(estimateLabelWidth(cut)).toBeGreaterThan(
      estimateLabelWidth(cut.replace(LABEL_ELLIPSIS, "")),
    )
  })
})

describe("labelBox", () => {
  it("sits beside the pin and above the coordinate, never under the tip", () => {
    const box = labelBox(BERLIN_SV, "Tienda Sarai 2", OVER_BERLIN)
    const { x, y } = projectToScreen(BERLIN_SV, OVER_BERLIN)

    // Clear of the pin's right edge — a box that reached back over the
    // coordinate would be the old centred-under-the-tip placement.
    expect(box.left).toBeGreaterThanOrEqual(x + LABEL_OFFSET_X - 3)
    expect(box.right).toBeGreaterThan(box.left)
    // Level with the pin's head, which is above the tip resting on the point.
    expect((box.top + box.bottom) / 2).toBeCloseTo(y + LABEL_OFFSET_Y, 6)
    expect(box.bottom).toBeLessThan(y)
  })
})

describe("boxesIntersect", () => {
  const box = (left: number, top: number): Box => ({
    left,
    top,
    right: left + 40,
    bottom: top + 20,
  })

  it("sees an overlap", () => {
    expect(boxesIntersect(box(0, 0), box(20, 10))).toBe(true)
  })

  it("lets boxes that merely touch edges through", () => {
    expect(boxesIntersect(box(0, 0), box(40, 0))).toBe(false)
  })

  it("does not confuse a shared column for an overlap", () => {
    expect(boxesIntersect(box(0, 0), box(0, 100))).toBe(false)
  })
})

describe("placeLabels", () => {
  // Forty merchants on one street, four metres apart — the density that made
  // the names unreadable.
  const CROWD = Array.from({ length: 40 }, (_, index) =>
    place(index + 1, 13.4956 + index * 0.00004, -88.5333 + index * 0.00004),
  )

  it("never returns two names whose boxes overlap", () => {
    const names = named(CROWD)
    const visible = placeLabels(CROWD, names, OVER_BERLIN)

    const boxes = CROWD.filter((p) => visible.has(p.id)).map((p) =>
      labelBox(p, names.get(p.id) as string, OVER_BERLIN),
    )

    boxes.forEach((box, index) => {
      const rest = boxes.slice(index + 1)
      expect(rest.some((other) => boxesIntersect(box, other))).toBe(false)
    })
  })

  it("drops names rather than showing them all in a crowd", () => {
    const visible = placeLabels(CROWD, named(CROWD), OVER_BERLIN)

    expect(visible.size).toBeGreaterThan(0)
    expect(visible.size).toBeLessThan(CROWD.length)
  })

  it("keeps the name nearest the middle of the screen when two collide", () => {
    // Two places close enough that only one name can be drawn; the first is on
    // the region's centre, the second a hair north-east of it.
    const centre = place(1, BERLIN_SV.latitude, BERLIN_SV.longitude)
    const nearby = place(2, BERLIN_SV.latitude + 0.00006, BERLIN_SV.longitude + 0.00006)
    const pair = [centre, nearby]

    const visible = placeLabels(pair, named(pair), OVER_BERLIN)

    expect(visible.size).toBe(1)
    expect(visible.has(centre.id)).toBe(true)
  })

  it("does not depend on the order the places arrived in", () => {
    const names = named(CROWD)
    const forwards = placeLabels(CROWD, names, OVER_BERLIN)
    const backwards = placeLabels([...CROWD].reverse(), names, OVER_BERLIN)

    expect([...backwards].sort()).toEqual([...forwards].sort())
  })

  it("labels everything when nothing is close enough to collide", () => {
    const spread = [
      place(1, 13.4946, -88.5343),
      place(2, 13.4966, -88.5323),
      place(3, 13.4946, -88.5323),
    ]

    expect(placeLabels(spread, named(spread), OVER_BERLIN).size).toBe(3)
  })

  it("skips a place whose name has not arrived yet", () => {
    const pending = [place(1, 13.4946, -88.5343), place(2, 13.4966, -88.5323)]
    const names = new Map([[1, "Lacteos Don Fila"]])

    const visible = placeLabels(pending, names, OVER_BERLIN)

    expect([...visible]).toEqual([1])
  })

  it("does not let a name off screen take the place of one on it", () => {
    // Both would collide with each other if the off-screen one were considered,
    // and the off-screen one is nearer the region's centre in nothing but
    // longitude — it is a screen away to the south.
    const offScreen = place(1, 13.4856, -88.5333)
    const onScreen = place(2, 13.4956, -88.5333)
    const both = [offScreen, onScreen]

    const visible = placeLabels(both, named(both), OVER_BERLIN)

    expect(visible.has(onScreen.id)).toBe(true)
    expect(visible.has(offScreen.id)).toBe(false)
  })

  it("labels nothing until the map has been laid out", () => {
    expect(
      placeLabels(CROWD, named(CROWD), {
        region: BERLIN_SV,
        viewport: { width: 0, height: 0 },
      }).size,
    ).toBe(0)
  })
})
