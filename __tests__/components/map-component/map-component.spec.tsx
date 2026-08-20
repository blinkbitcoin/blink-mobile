import React from "react"
import { Region } from "react-native-maps"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"

import { BtcMapPlace, useBtcMapPlaceNames, useBtcMapPlaces } from "@app/btcmap"
import MapComponent from "@app/components/map-component"
import MapStyles from "@app/components/map-component/map-styles.json"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { getUserRegion } from "@app/screens/map-screen/functions"

import { ContextForScreen } from "../../screens/helper"

const mockRefresh = jest.fn()

jest.mock("@app/btcmap/use-places", () => ({ useBtcMapPlaces: jest.fn() }))

jest.mock("@app/btcmap/use-place-names", () => ({ useBtcMapPlaceNames: jest.fn() }))

jest.mock("@app/screens/map-screen/functions", () => ({
  LOCATION_PERMISSION: "LOCATION",
  getUserRegion: jest.fn(),
}))

jest.mock("react-native-permissions", () => ({
  request: jest.fn().mockResolvedValue("granted"),
  RESULTS: {
    GRANTED: "granted",
    DENIED: "denied",
    BLOCKED: "blocked",
    UNAVAILABLE: "unavailable",
    LIMITED: "limited",
  },
}))

let capturedMapProps: Record<string, unknown> | undefined
jest.mock("react-native-maps", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  const MapView = ReactActual.forwardRef(
    (props: { children?: React.ReactNode }, _ref: React.Ref<unknown>) => {
      capturedMapProps = props as Record<string, unknown>
      return ReactActual.createElement(RN.View, { testID: "map-view" }, props.children)
    },
  )
  MapView.displayName = "MockMapView"
  return {
    __esModule: true,
    default: MapView,
    Marker: (props: Record<string, unknown> & { children?: React.ReactNode }) =>
      ReactActual.createElement(
        RN.View,
        { testID: props.testID as string },
        props.children as React.ReactNode,
      ),
  }
})

// The sheet has its own spec; here it only needs to report what it was handed.
let capturedSheetProps: Record<string, unknown> | undefined
jest.mock("@app/components/map-component/place-sheet", () => ({
  PlaceSheet: (props: Record<string, unknown>) => {
    capturedSheetProps = props
    return null
  },
}))

// Same for the search and the filter: each has its own spec, so here they are
// only a way to see what the map asks them for and to answer back.
let capturedSearchProps: Record<string, unknown> | undefined
jest.mock("@app/components/map-component/place-search-modal", () => ({
  PlaceSearchModal: (props: Record<string, unknown>) => {
    capturedSearchProps = props
    return null
  },
}))

let capturedFilterProps: Record<string, unknown> | undefined
jest.mock("@app/components/map-component/category-filter-sheet", () => ({
  CategoryFilterSheet: (props: Record<string, unknown>) => {
    capturedFilterProps = props
    return null
  },
}))

const mockedPlaces = useBtcMapPlaces as jest.MockedFunction<typeof useBtcMapPlaces>
const mockedNames = useBtcMapPlaceNames as jest.MockedFunction<typeof useBtcMapPlaceNames>
const mockedGetUserRegion = getUserRegion as jest.MockedFunction<typeof getUserRegion>

const REGION: Region = {
  latitude: 51.5,
  longitude: -0.12,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
}

const place = (id: number, icon = "local_cafe"): BtcMapPlace => ({
  id,
  latitude: 51.5 + id / 10000,
  longitude: -0.12,
  icon,
})

const setPlaces = (overrides: Partial<ReturnType<typeof useBtcMapPlaces>> = {}) =>
  mockedPlaces.mockReturnValue({
    places: [],
    isLoading: false,
    hasError: false,
    refresh: mockRefresh,
    ...overrides,
  })

const renderMap = (props: Partial<React.ComponentProps<typeof MapComponent>> = {}) =>
  render(
    <ContextForScreen>
      <MapComponent
        userLocation={REGION}
        setPermissionsStatus={jest.fn()}
        alertOnLocationError={jest.fn()}
        {...props}
      />
    </ContextForScreen>,
  )

beforeEach(() => {
  jest.clearAllMocks()
  loadLocale("en")
  capturedSheetProps = undefined
  capturedSearchProps = undefined
  capturedFilterProps = undefined
  capturedMapProps = undefined
  setPlaces()
  mockedNames.mockReturnValue(new Map())
})

// The map is measured before anything can be placed in it, and the placement
// works in the view's own pixels — so a test that wants labels has to lay it out.
const layOutMap = async (width = 384, height = 720) => {
  await waitFor(() => expect(capturedMapProps?.onLayout).toBeDefined())
  await act(async () => {
    ;(capturedMapProps?.onLayout as (event: unknown) => void)({
      nativeEvent: { layout: { width, height, x: 0, y: 0 } },
    })
  })
}

describe("MapComponent", () => {
  it("says it is loading only while there is nothing to show", async () => {
    setPlaces({ isLoading: true })
    const loading = renderMap()
    await waitFor(() =>
      expect(loading.getByText("Loading places from BTC Map")).toBeTruthy(),
    )

    // A background refresh over an already-drawn map is not worth a banner.
    setPlaces({ isLoading: true, places: [place(1)] })
    const refreshing = renderMap()
    expect(refreshing.queryByText("Loading places from BTC Map")).toBeNull()
  })

  it("offers a retry when the places could not be loaded", async () => {
    setPlaces({ hasError: true })
    const { getByText } = renderMap()

    await waitFor(() =>
      expect(getByText("Couldn't load places from BTC Map")).toBeTruthy(),
    )
    fireEvent.press(getByText("Try Again"))

    expect(mockRefresh).toHaveBeenCalled()
  })

  it("keeps the licence credit off the map, where a large font swallowed it", async () => {
    // It is a chip at a fixed 11pt no longer: at the system's largest font size
    // it grew over the streets it was crediting. The credit now reads as a
    // footnote at the foot of the place sheet, where it has room to grow — see
    // place-sheet.spec.tsx.
    const { queryByText } = renderMap()

    await waitFor(() => expect(queryByText(/OpenStreetMap/)).toBeNull())
  })

  it("draws a pin for each place the clusterer resolves", async () => {
    setPlaces({ places: [place(1), place(2)] })
    const { getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("btcmap-place-1")).toBeTruthy())
    expect(getByTestId("btcmap-place-2")).toBeTruthy()
  })

  it("labels a place whose name has arrived, beside its pin", async () => {
    const shop = place(1)
    setPlaces({ places: [shop] })
    mockedNames.mockReturnValue(new Map([[shop.id, "Pupusería Victoria"]]))

    const { getByTestId } = renderMap()
    await layOutMap()

    expect(getByTestId("btcmap-label-1")).toBeTruthy()
  })

  it("drops the names that would land on each other, keeping the pins", async () => {
    // Two merchants eleven metres apart — the density of Berlín, SV, where every
    // name overlapped its neighbours into noise. Both pins must still draw: it
    // is the name that loses a collision, never the merchant.
    const near = { latitude: 51.5, longitude: -0.12, icon: "local_cafe" }
    const places = [
      { ...near, id: 1 },
      { ...near, id: 2, latitude: 51.5001 },
    ]
    setPlaces({ places })
    mockedNames.mockReturnValue(
      new Map([
        [1, "Pupusería Victoria"],
        [2, "Tienda Maxim"],
      ]),
    )

    const { getByTestId, queryByTestId } = renderMap()
    await layOutMap()

    expect(getByTestId("btcmap-place-1")).toBeTruthy()
    expect(getByTestId("btcmap-place-2")).toBeTruthy()

    const labelled = [1, 2].filter((id) => queryByTestId(`btcmap-label-${id}`))
    expect(labelled).toHaveLength(1)
  })

  it("labels both when there is room for both", async () => {
    // The same two names, a third of the viewport apart rather than a hair.
    const places = [
      { id: 1, latitude: 51.5, longitude: -0.12, icon: "local_cafe" },
      { id: 2, latitude: 51.4945, longitude: -0.126, icon: "local_cafe" },
    ]
    setPlaces({ places })
    mockedNames.mockReturnValue(
      new Map([
        [1, "Pupusería Victoria"],
        [2, "Tienda Maxim"],
      ]),
    )

    const { getByTestId } = renderMap()
    await layOutMap()

    expect(getByTestId("btcmap-label-1")).toBeTruthy()
    expect(getByTestId("btcmap-label-2")).toBeTruthy()
  })

  it("cuts a long name down rather than drawing it across the map", async () => {
    const shop = place(1)
    setPlaces({ places: [shop] })
    mockedNames.mockReturnValue(new Map([[shop.id, "Pupusería Victoria"]]))

    const { getByText, queryByText } = renderMap()
    await layOutMap()

    expect(getByText("Pupusería Victor\u2026")).toBeTruthy()
    expect(queryByText("Pupusería Victoria")).toBeNull()
  })

  it("reserves for a shortened name only the strip it draws in", async () => {
    // The collision pass and the view have to be handed the same string. Given
    // the whole name the pass measures a box that clamps to the widest a label
    // may be and takes that strip away from the neighbour — while the view
    // draws sixteen characters and leaves most of it empty.
    //
    // These two sit 100dp apart at this region's scale: wider than the box a
    // sixteen-character name needs, narrower than the one the full name claims.
    // Truncate in only one of the two places and the second name disappears.
    const dpToLongitude = REGION.longitudeDelta / 384
    const places = [
      {
        id: 1,
        latitude: REGION.latitude,
        longitude: REGION.longitude - 50 * dpToLongitude,
        icon: "local_cafe",
      },
      {
        id: 2,
        latitude: REGION.latitude,
        longitude: REGION.longitude + 50 * dpToLongitude,
        icon: "local_cafe",
      },
    ]
    setPlaces({ places })
    mockedNames.mockReturnValue(
      new Map([
        [1, "l".repeat(60)],
        [2, "l".repeat(60)],
      ]),
    )

    const { getByTestId } = renderMap()
    await layOutMap()

    expect(getByTestId("btcmap-label-1")).toBeTruthy()
    expect(getByTestId("btcmap-label-2")).toBeTruthy()
  })

  it("opens the sheet on the place that was tapped", async () => {
    setPlaces({ places: [place(1)] })
    const { getByTestId } = renderMap()

    await waitFor(() => expect(capturedSheetProps?.place).toBeNull())
    fireEvent.press(getByTestId("btcmap-place-1"))

    await waitFor(() => expect((capturedSheetProps?.place as BtcMapPlace)?.id).toBe(1))
  })

  it("starts trusting the device clock once location is granted mid-session", async () => {
    // The opening-hours badge is gated on knowing where the user is; granting
    // permission from the map must not leave that dead until an app restart.
    mockedGetUserRegion.mockImplementation((callback) => callback(REGION))
    const { getByTestId } = renderMap()

    await waitFor(() => expect(capturedSheetProps?.userLocation).toBeUndefined())

    fireEvent.press(getByTestId("location-button"))

    await waitFor(() =>
      expect(capturedSheetProps?.userLocation).toEqual({
        latitude: REGION.latitude,
        longitude: REGION.longitude,
      }),
    )
  })
})

describe("MapComponent search", () => {
  it("keeps the search shut until it is asked for", async () => {
    const { getByTestId } = renderMap()

    await waitFor(() => expect(capturedSearchProps?.isVisible).toBe(false))

    fireEvent.press(getByTestId("open-place-search"))

    await waitFor(() => expect(capturedSearchProps?.isVisible).toBe(true))
  })

  it("searches the area the map is looking at", async () => {
    renderMap()

    await waitFor(() =>
      expect(capturedSearchProps?.center).toEqual({
        latitude: REGION.latitude,
        longitude: REGION.longitude,
      }),
    )
    expect(capturedSearchProps?.viewportRadiusKm).toBeGreaterThan(0)
  })

  it("hands the search the phone's own position to measure distances from", async () => {
    // Without it the list has no honest distance to print, so it must arrive
    // rather than be inferred from where the map happens to be pointed.
    mockedGetUserRegion.mockImplementation((callback) => callback(REGION))
    const { getByTestId } = renderMap()

    await waitFor(() => expect(capturedSearchProps?.userLocation).toBeUndefined())

    fireEvent.press(getByTestId("location-button"))

    await waitFor(() =>
      expect(capturedSearchProps?.userLocation).toEqual({
        latitude: REGION.latitude,
        longitude: REGION.longitude,
      }),
    )
  })

  it("opens the sheet on the place picked out of the search", async () => {
    const { getByTestId } = renderMap()

    await waitFor(() => expect(capturedSearchProps).toBeDefined())
    fireEvent.press(getByTestId("open-place-search"))

    const picked = { ...place(7), name: "Satoshi Coffee" }
    act(() => {
      ;(capturedSearchProps?.onSelect as (p: BtcMapPlace) => void)(picked)
    })

    // Closed, so the map it just flew to is what the user is left looking at.
    await waitFor(() => expect(capturedSearchProps?.isVisible).toBe(false))

    // But no sheet yet: both are native modals, and iOS silently drops one
    // presented while the other is still dismissing. (The test environment is
    // iOS; Android skips the wait, since its dialogs do not collide.)
    expect(capturedSheetProps?.place).toBeNull()

    act(() => {
      ;(capturedSearchProps?.onDismiss as () => void)()
    })

    await waitFor(() => expect((capturedSheetProps?.place as BtcMapPlace)?.id).toBe(7))
  })

  it("does not open a sheet when the search is dismissed without a pick", async () => {
    const { getByTestId } = renderMap()

    await waitFor(() => expect(capturedSearchProps).toBeDefined())
    fireEvent.press(getByTestId("open-place-search"))

    act(() => {
      ;(capturedSearchProps?.onClose as () => void)()
      ;(capturedSearchProps?.onDismiss as () => void)()
    })

    await waitFor(() => expect(capturedSearchProps?.isVisible).toBe(false))
    expect(capturedSheetProps?.place).toBeNull()
  })
})

describe("MapComponent category filter", () => {
  const chooseMoney = () =>
    act(() => {
      ;(capturedFilterProps?.onChange as (c: ReadonlySet<string>) => void)(
        new Set(["money"]),
      )
    })

  it("keeps the filter shut until it is asked for", async () => {
    const { getByTestId } = renderMap()

    await waitFor(() => expect(capturedFilterProps?.isVisible).toBe(false))

    fireEvent.press(getByTestId("open-category-filter"))

    await waitFor(() => expect(capturedFilterProps?.isVisible).toBe(true))
  })

  it("draws every pin until a category is chosen", async () => {
    setPlaces({ places: [place(1, "restaurant"), place(2, "local_atm")] })
    const { getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("btcmap-place-1")).toBeTruthy())
    expect(getByTestId("btcmap-place-2")).toBeTruthy()
  })

  it("drops the pins outside the chosen categories", async () => {
    setPlaces({ places: [place(1, "restaurant"), place(2, "local_atm")] })
    const { getByTestId, queryByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("btcmap-place-1")).toBeTruthy())
    chooseMoney()

    await waitFor(() => expect(queryByTestId("btcmap-place-1")).toBeNull())
    expect(getByTestId("btcmap-place-2")).toBeTruthy()
  })

  it("puts every pin back when the filter is cleared", async () => {
    setPlaces({ places: [place(1, "restaurant"), place(2, "local_atm")] })
    const { getByTestId, queryByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("btcmap-place-1")).toBeTruthy())
    chooseMoney()
    await waitFor(() => expect(queryByTestId("btcmap-place-1")).toBeNull())

    act(() => {
      ;(capturedFilterProps?.onChange as (c: ReadonlySet<string>) => void)(new Set())
    })

    await waitFor(() => expect(getByTestId("btcmap-place-1")).toBeTruthy())
  })

  it("says on the button that the map is showing less than everything", async () => {
    // The tint alone does not reach a screen reader, and "why is my shop
    // missing" is exactly the question a forgotten filter creates.
    const { getByTestId } = renderMap()

    await waitFor(() =>
      expect(getByTestId("open-category-filter").props.accessibilityState).toMatchObject({
        selected: false,
      }),
    )

    chooseMoney()

    await waitFor(() =>
      expect(getByTestId("open-category-filter").props.accessibilityState).toMatchObject({
        selected: true,
      }),
    )
  })

  it("tells the search what the map is already filtered to", async () => {
    // Otherwise the list contradicts the map it is sitting over.
    setPlaces({ places: [place(1, "restaurant")] })
    renderMap()

    await waitFor(() => expect(capturedFilterProps).toBeDefined())
    chooseMoney()

    await waitFor(() =>
      expect(capturedSearchProps?.categories).toEqual(new Set(["money"])),
    )
  })
})

describe("MapComponent basemap", () => {
  it("hides the basemap's own places so only our pins are on the map", async () => {
    // Apple Maps ignores customMapStyle, so iOS needs the prop; Android needs
    // the style sheet. Dropping either one puts Google's or Apple's own
    // restaurants and shops back next to merchants we actually vouch for.
    renderMap()

    await waitFor(() => expect(capturedMapProps).toBeDefined())
    expect(capturedMapProps?.showsPointsOfInterests).toBe(false)

    expect(capturedMapProps?.customMapStyle).toBeDefined()
  })

  it("suppresses the basemap's places in both themes", () => {
    // Light shipped as an empty array, so Google drew every default POI; dark
    // only recoloured their labels.
    type Rule = {
      featureType?: string
      elementType?: string
      stylers: Record<string, string>[]
    }
    const themes: Rule[][] = [MapStyles.light, MapStyles.dark]

    for (const rules of themes) {
      const hides = (featureType: string, elementType?: string) =>
        rules.some(
          (rule) =>
            rule.featureType === featureType &&
            rule.elementType === elementType &&
            rule.stylers.some((styler) => styler.visibility === "off"),
        )

      expect(hides("poi", "labels")).toBe(true)
      expect(hides("poi.business")).toBe(true)
      expect(hides("transit", "labels")).toBe(true)
    }
  })

  it("quiets the street names the merchant labels have to be read against", () => {
    // Every side street carrying its name is the layer our own labels compete
    // with hardest — same size, same weight, drawn underneath and everywhere.
    // Highways keep theirs: with nothing named at all the map stops being
    // navigable, and a motorway label is rare enough not to crowd a merchant.
    //
    // Android only. iOS draws Apple Maps, which ignores this style sheet and
    // offers no equivalent, so street names stay there — `showsPointsOfInterests`
    // is the only label control MapKit exposes and it does not reach roads.
    type Rule = {
      featureType?: string
      elementType?: string
      stylers: Record<string, string>[]
    }
    const themes: Rule[][] = [MapStyles.light, MapStyles.dark]

    for (const rules of themes) {
      const hides = (featureType: string) =>
        rules.some(
          (rule) =>
            rule.featureType === featureType &&
            rule.elementType === "labels" &&
            rule.stylers.some((styler) => styler.visibility === "off"),
        )

      expect(hides("road.local")).toBe(true)
      expect(hides("road.arterial")).toBe(true)
      expect(hides("road")).toBe(false)
      expect(hides("road.highway")).toBe(false)
    }
  })
})
