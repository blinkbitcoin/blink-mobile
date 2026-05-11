import { MapMarker } from "@app/graphql/generated"
import {
  btcMapPlaceToMarker,
  btcMapSearchUrlForRegion,
  calculateBtcMapRadiusKm,
  mergeMapMarkers,
} from "@app/screens/map-screen/btc-map"

const blinkMarker = {
  username: "hope-house",
  mapInfo: {
    title: "Hope House",
    coordinates: {
      latitude: 13.4972995,
      longitude: -89.4414673,
    },
  },
} as MapMarker

const osmIdField = "osm_id"
const verifiedAtField = "verified_at"

describe("btc map markers", () => {
  it("maps BTC Map places to mobile map markers", () => {
    const marker = btcMapPlaceToMarker({
      id: 239,
      lat: 13.4972995,
      lon: -89.4414673,
      name: "Hope House",
      address: "El Zonte",
      website: "https://hopehouseelsalvador.org/",
      [osmIdField]: "node:10065166137",
      [verifiedAtField]: "2026-01-06T00:00:00Z",
    })

    expect(marker).toEqual({
      source: "btcmap",
      id: "btcmap:239",
      btcMapId: 239,
      btcMapUrl: "https://btcmap.org/merchant/239",
      address: "El Zonte",
      website: "https://hopehouseelsalvador.org/",
      osmId: "node:10065166137",
      verifiedAt: "2026-01-06T00:00:00Z",
      mapInfo: {
        title: "Hope House",
        coordinates: {
          latitude: 13.4972995,
          longitude: -89.4414673,
        },
      },
    })
  })

  it("does not create markers without coordinates", () => {
    expect(btcMapPlaceToMarker({ id: 1, name: "Missing Coordinates" })).toBeUndefined()
  })

  it("caps wide viewport searches before calling BTC Map", () => {
    const radiusKm = calculateBtcMapRadiusKm({
      latitude: 13.496743,
      longitude: -89.439462,
      latitudeDelta: 15,
      longitudeDelta: 15,
    })

    expect(radiusKm).toBe(100)
    expect(
      btcMapSearchUrlForRegion({
        latitude: 13.496743,
        longitude: -89.439462,
        latitudeDelta: 15,
        longitudeDelta: 15,
      }),
    ).toBe(
      "https://api.btcmap.org/v4/places/search/?lat=13.496743&lon=-89.439462&radius_km=100.0",
    )
  })

  it("keeps Blink markers when BTC Map returns a duplicate coordinate", () => {
    const duplicateMarker = btcMapPlaceToMarker({
      id: 239,
      lat: 13.4972995,
      lon: -89.4414673,
      name: "Hope House",
    })

    expect(duplicateMarker).toBeDefined()
    const markers = mergeMapMarkers(
      [blinkMarker],
      duplicateMarker ? [duplicateMarker] : [],
    )

    expect(markers).toEqual([blinkMarker])
  })
})
