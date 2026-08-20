import {
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
  PlaceSubmissionDraft,
  buildPlaceSubmission,
  formatCoordinates,
} from "@app/btcmap/submission"

const LOCATION = { latitude: 13.496743, longitude: -89.439462 }

const draft = (overrides: Partial<PlaceSubmissionDraft> = {}): PlaceSubmissionDraft => ({
  name: "Hope House",
  address: "Calle El Zonte",
  category: "cafes",
  location: LOCATION,
  ...overrides,
})

describe("buildPlaceSubmission", () => {
  it("carries every filled-in field through", () => {
    expect(buildPlaceSubmission(draft())).toEqual({
      name: "Hope House",
      address: "Calle El Zonte",
      category: "cafes",
      latitude: LOCATION.latitude,
      longitude: LOCATION.longitude,
    })
  })

  it("refuses a place with nothing to call it", () => {
    // Whitespace is not a name: the survey it turns into has to identify
    // something to whoever walks there.
    expect(buildPlaceSubmission(draft({ name: "" }))).toBeNull()
    expect(buildPlaceSubmission(draft({ name: "   " }))).toBeNull()
  })

  it("refuses a place with no category", () => {
    // BTC Map draws a place as the icon its category resolves to, so one
    // without a category is a place with no pin.
    expect(buildPlaceSubmission(draft({ category: null }))).toBeNull()
  })

  it("refuses a place that was never put anywhere", () => {
    expect(buildPlaceSubmission(draft({ location: null }))).toBeNull()
  })

  it("refuses coordinates that are not on the globe", () => {
    expect(
      buildPlaceSubmission(draft({ location: { latitude: 91, longitude: 0 } })),
    ).toBeNull()
    expect(
      buildPlaceSubmission(draft({ location: { latitude: 0, longitude: -181 } })),
    ).toBeNull()
    expect(
      buildPlaceSubmission(draft({ location: { latitude: NaN, longitude: 0 } })),
    ).toBeNull()
  })

  it("keeps a place sitting exactly on a pole or the date line", () => {
    // The bounds are inclusive; somewhere on them is a real place, not a typo.
    expect(
      buildPlaceSubmission(draft({ location: { latitude: -90, longitude: 180 } })),
    ).toMatchObject({ latitude: -90, longitude: 180 })
  })

  it("trims what was typed rather than sending the spaces around it", () => {
    expect(buildPlaceSubmission(draft({ name: "  Hope House  " }))).toMatchObject({
      name: "Hope House",
    })
  })

  it("leaves the address out entirely when nobody typed one", () => {
    // It is optional, and an empty string is a value: sending one would claim
    // the place has an address that is blank.
    const submission = buildPlaceSubmission(draft({ address: "   " }))

    expect(submission).not.toBeNull()
    expect(submission).not.toHaveProperty("address")
  })

  it("caps both free-text fields", () => {
    const submission = buildPlaceSubmission(
      draft({ name: "a".repeat(500), address: "b".repeat(500) }),
    )

    expect(submission?.name).toHaveLength(PLACE_NAME_MAX_LENGTH)
    expect(submission?.address).toHaveLength(PLACE_ADDRESS_MAX_LENGTH)
  })
})

describe("formatCoordinates", () => {
  it("prints both halves to the precision OpenStreetMap itself stores", () => {
    expect(formatCoordinates(LOCATION)).toBe("13.496743, -89.439462")
  })

  it("pads a round number out rather than shortening it", () => {
    // Two coordinates of different lengths would jitter the row they sit in as
    // the map is panned.
    expect(formatCoordinates({ latitude: 0, longitude: -1.5 })).toBe(
      "0.000000, -1.500000",
    )
  })
})
