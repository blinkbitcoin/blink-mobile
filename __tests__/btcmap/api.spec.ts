import axios from "axios"

import { fetchPlaceDetails, fetchPlacesDelta, fetchPlacesSnapshot } from "@app/btcmap/api"
import { BTCMAP_MAX_PAGES, BTCMAP_PAGE_SIZE } from "@app/btcmap/config"

jest.mock("axios")

const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>

const wirePlace = (id: number, updatedAt: string, overrides = {}) => ({
  id,
  lat: 1 + id / 1000,
  lon: 2 + id / 1000,
  icon: "storefront",
  // eslint-disable-next-line camelcase
  updated_at: updatedAt,
  ...overrides,
})

const page = (places: unknown[]) => ({ data: places, headers: {} })

const paramsOf = (call: number) =>
  (mockedGet.mock.calls[call][1] as { params: Record<string, unknown> }).params

beforeEach(() => {
  jest.clearAllMocks()
})

describe("fetchPlacesSnapshot", () => {
  it("drops rows the map cannot draw", async () => {
    mockedGet.mockResolvedValue({
      data: [
        { id: 1, lat: 10, lon: 20, icon: "hotel" },
        { id: 2, lon: 20, icon: "hotel" },
        // eslint-disable-next-line camelcase
        { id: 3, lat: 10, lon: 20, icon: "hotel", deleted_at: "2026-01-01T00:00:00Z" },
      ],
      headers: { "last-modified": "Thu, 13 Aug 2026 22:02:26 GMT" },
    })

    const { places } = await fetchPlacesSnapshot()

    expect(places).toEqual([
      { id: 1, latitude: 10, longitude: 20, icon: "hotel", boostedUntil: undefined },
    ])
  })

  it("rewinds the CDN stamp, which runs ahead of the newest row it contains", async () => {
    mockedGet.mockResolvedValue({
      data: [],
      headers: { "last-modified": "Thu, 13 Aug 2026 22:02:26 GMT" },
    })

    const { syncedUpTo } = await fetchPlacesSnapshot()

    expect(new Date(syncedUpTo).getTime()).toBeLessThan(
      new Date("2026-08-13T22:02:26Z").getTime(),
    )
  })

  it("falls back to a full walk when the CDN sends no usable stamp", async () => {
    mockedGet.mockResolvedValue({ data: [], headers: {} })

    const { syncedUpTo } = await fetchPlacesSnapshot()

    expect(new Date(syncedUpTo).getTime()).toBe(0)
  })
})

describe("fetchPlacesDelta", () => {
  it("splits changes into what to draw and what to forget", async () => {
    mockedGet.mockResolvedValue(
      page([
        wirePlace(1, "2026-08-01T00:00:00.000Z"),
        // eslint-disable-next-line camelcase
        wirePlace(2, "2026-08-02T00:00:00.000Z", { deleted_at: "2026-08-02T00:00:00Z" }),
      ]),
    )

    const delta = await fetchPlacesDelta("2026-07-01T00:00:00.000Z")

    expect(delta.upserted.map((place) => place.id)).toEqual([1])
    expect(delta.removedIds).toEqual([2])
  })

  it("keeps only the latest copy of a place that changed twice", async () => {
    mockedGet
      .mockResolvedValueOnce(
        page(
          Array.from({ length: BTCMAP_PAGE_SIZE }, (_, index) =>
            wirePlace(
              index + 1,
              `2026-08-01T00:00:00.${String(index).padStart(3, "0")}Z`,
            ),
          ),
        ),
      )
      .mockResolvedValueOnce(
        page([
          wirePlace(1, "2026-08-03T00:00:00.000Z", {
            // eslint-disable-next-line camelcase
            deleted_at: "2026-08-03T00:00:00Z",
          }),
        ]),
      )

    const delta = await fetchPlacesDelta("2026-07-01T00:00:00.000Z")

    expect(delta.removedIds).toEqual([1])
    expect(delta.upserted.some((place) => place.id === 1)).toBe(false)
  })

  it("rewinds the paging cursor so rows sharing a timestamp are not stepped over", async () => {
    mockedGet
      .mockResolvedValueOnce(
        page(
          Array.from({ length: BTCMAP_PAGE_SIZE }, (_, index) =>
            wirePlace(index + 1, "2026-08-01T00:00:00.500Z"),
          ).map((place, index) =>
            index === BTCMAP_PAGE_SIZE - 1
              ? // eslint-disable-next-line camelcase
                { ...place, updated_at: "2026-08-02T00:00:00.500Z" }
              : place,
          ),
        ),
      )
      .mockResolvedValueOnce(page([]))

    await fetchPlacesDelta("2026-07-01T00:00:00.000Z")

    expect(paramsOf(1).updated_since).toBe("2026-08-02T00:00:00.499Z")
  })

  it("asks for a reseed rather than stranding a timestamp group bigger than a page", async () => {
    // Every rewound request returns the same first PAGE_SIZE rows, and there is
    // no id cursor to reach the rest — so the only lossless move is to start
    // over from the CDN snapshot.
    mockedGet.mockResolvedValue(
      page(
        Array.from({ length: BTCMAP_PAGE_SIZE }, (_, index) =>
          wirePlace(index + 1, "2026-08-01T00:00:00.000Z"),
        ),
      ),
    )

    const delta = await fetchPlacesDelta("2026-07-01T00:00:00.000Z")

    expect(delta.needsReseed).toBe(true)
    // No cursor is advanced past a group we could not finish reading.
    expect(delta.syncedUpTo).toBe("2026-07-01T00:00:00.000Z")
    expect(delta.upserted).toEqual([])
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it("pages normally when a full page merely ends inside a tie group", async () => {
    const rows = Array.from({ length: BTCMAP_PAGE_SIZE }, (_, index) =>
      wirePlace(
        index + 1,
        `2026-08-01T00:00:00.${String(index % 900).padStart(3, "0")}Z`,
      ),
    )
    mockedGet.mockResolvedValueOnce(page(rows)).mockResolvedValueOnce(page([]))

    const delta = await fetchPlacesDelta("2026-07-01T00:00:00.000Z")

    expect(delta.needsReseed).toBe(false)
    expect(delta.upserted).toHaveLength(BTCMAP_PAGE_SIZE)
  })

  it("never hands back a cursor earlier than the one it was given", async () => {
    mockedGet.mockResolvedValue(page([wirePlace(1, "2026-08-01T00:00:00.000Z")]))

    const delta = await fetchPlacesDelta("2026-08-01T00:00:00.000Z")

    expect(new Date(delta.syncedUpTo).getTime()).toBeGreaterThanOrEqual(
      new Date("2026-08-01T00:00:00.000Z").getTime(),
    )
  })

  it("asks for tombstones, which is also what makes the API return them", async () => {
    mockedGet.mockResolvedValue(page([]))

    await fetchPlacesDelta("2026-07-01T00:00:00.000Z")

    expect(String(paramsOf(0).fields)).toContain("deleted_at")
  })

  it("stops at the page ceiling with a cursor the next sync can carry on from", async () => {
    // A backlog that never runs out — a full resync is 6 pages, so reaching 40
    // means either the dataset grew many times over or the cursor is not
    // advancing. Either way the walk stops, and what it stops with has to be
    // resumable: everything collected so far, and a cursor past it. Dropping
    // the cursor here would replay the same 40 pages on every launch forever.
    // Distinct timestamps within each page, so this is an endless backlog
    // rather than the timestamp-tie case that asks for a reseed instead.
    const start = Date.UTC(2026, 6, 1)
    let tick = 0
    mockedGet.mockImplementation(async () =>
      page(
        Array.from({ length: BTCMAP_PAGE_SIZE }, () => {
          tick += 1
          return wirePlace(tick, new Date(start + tick * 1000).toISOString())
        }),
      ),
    )

    const delta = await fetchPlacesDelta("2026-07-01T00:00:00.000Z")

    expect(mockedGet).toHaveBeenCalledTimes(BTCMAP_MAX_PAGES)
    expect(delta.needsReseed).toBe(false)
    expect(delta.upserted.length).toBeGreaterThan(0)
    expect(new Date(delta.syncedUpTo).getTime()).toBeGreaterThan(
      new Date("2026-07-01T00:00:00.000Z").getTime(),
    )
  })
})

describe("fetchPlaceDetails", () => {
  it("reads contact fallbacks out of the raw OSM tags", async () => {
    mockedGet.mockResolvedValue({
      data: {
        "id": 7,
        "name": "Cafe",
        "osm:contact:phone": "+1 555 0100",
      },
      headers: {},
    })

    const details = await fetchPlaceDetails(7)

    expect(details.phone).toBe("+1 555 0100")
  })

  it("no longer asks for the accepted-payment-method tags", async () => {
    // Nothing renders them, so they are not worth the response size.
    mockedGet.mockResolvedValue({ data: { id: 7 }, headers: {} })

    await fetchPlaceDetails(7)

    const fields = String(paramsOf(0).fields)
    expect(fields).not.toContain("osm:payment:lightning")
    expect(fields).not.toContain("osm:payment:onchain")
    // The payment URI is a different thing and is still needed.
    expect(fields).toContain("osm:payment:uri")
  })

  it("prefers the promoted field over its raw OSM twin", async () => {
    mockedGet.mockResolvedValue({
      data: { "id": 7, "phone": "+1 555 0199", "osm:contact:phone": "+1 555 0100" },
      headers: {},
    })

    expect((await fetchPlaceDetails(7)).phone).toBe("+1 555 0199")
  })

  it("refuses a payment URI whose scheme is not one we are willing to hand off to", async () => {
    mockedGet.mockResolvedValue({
      // eslint-disable-next-line no-script-url -- the hostile input under test
      data: { "id": 7, "osm:payment:uri": "javascript:alert(1)" },
      headers: {},
    })

    expect((await fetchPlaceDetails(7)).paymentUrl).toBeUndefined()
  })

  it("accepts the payment schemes a wallet can act on", async () => {
    mockedGet.mockResolvedValue({
      data: { "id": 7, "osm:payment:uri": " lightning:lnurl1abc " },
      headers: {},
    })

    expect((await fetchPlaceDetails(7)).paymentUrl).toBe("lightning:lnurl1abc")
  })

  it("builds the hosted wallet links BTC Map stores as bare usernames", async () => {
    mockedGet.mockResolvedValue({
      data: { "id": 7, "osm:payment:pouch": "alice" },
      headers: {},
    })

    expect((await fetchPlaceDetails(7)).paymentUrl).toBe("https://app.pouch.ph/alice")
  })
})
