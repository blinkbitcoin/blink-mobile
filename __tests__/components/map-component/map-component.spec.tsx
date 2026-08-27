import React from "react"
import { Region } from "react-native-maps"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"

import { BtcMapPlace, useBtcMapPlaces } from "@app/btcmap"
import MapComponent from "@app/components/map-component"
import MapStyles from "@app/components/map-component/map-styles.json"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { getUserRegion } from "@app/screens/map-screen/functions"

import { ContextForScreen } from "../../screens/helper"

const mockRefresh = jest.fn()

jest.mock("@app/btcmap/use-places", () => ({ useBtcMapPlaces: jest.fn() }))

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

// The form has its own spec too. Adding a place is two steps and only the first
// happens on the map, so this stands in for the second.
//
// It counts its own mountings as well as reporting its props: the form holds
// what has been typed, so the map throwing a half-filled one away is a mount
// and keeping it across a trip back to the pin is the absence of one.
let capturedAddPlaceProps: Record<string, unknown> | undefined
let addPlaceMountCount = 0
jest.mock("@app/components/map-component/add-place-modal", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  return {
    AddPlaceModal: (props: Record<string, unknown>) => {
      capturedAddPlaceProps = props
      ReactActual.useEffect(() => {
        addPlaceMountCount += 1
      }, [])
      return null
    },
  }
})

// Which account is signed in is the whole gate on adding a place, so both
// halves of it are driven from here.
let mockIsAuthed = true
jest.mock("@app/graphql/is-authed-context", () => ({
  ...jest.requireActual("@app/graphql/is-authed-context"),
  useIsAuthed: () => mockIsAuthed,
}))

let mockIsSelfCustodialAccount = false
jest.mock("@app/hooks/use-is-self-custodial-account", () => ({
  useIsSelfCustodialAccount: () => mockIsSelfCustodialAccount,
}))

// The backend refuses place submissions below account level two, so the
// button's third gate is driven from here too.
let mockIsAtLeastLevelTwo = true
jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => ({ isAtLeastLevelTwo: mockIsAtLeastLevelTwo }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (args: unknown) => mockToastShow(args),
}))

// The hook talks to the backend; here the map only needs to be told whether
// the place went.
const mockSubmitPlace = jest.fn()
jest.mock("@app/btcmap/use-place-submission", () => ({
  useSubmitBtcMapPlace: () => ({ submitPlace: mockSubmitPlace }),
}))

const mockedPlaces = useBtcMapPlaces as jest.MockedFunction<typeof useBtcMapPlaces>
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
  capturedAddPlaceProps = undefined
  addPlaceMountCount = 0
  capturedMapProps = undefined
  mockIsAuthed = true
  mockIsSelfCustodialAccount = false
  mockIsAtLeastLevelTwo = true
  mockSubmitPlace.mockResolvedValue(true)
  setPlaces()
})

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

  it("credits OpenStreetMap, which the data's licence requires", async () => {
    const { getByText } = renderMap()

    await waitFor(() =>
      expect(
        getByText("Places from BTC Map, © OpenStreetMap contributors"),
      ).toBeTruthy(),
    )
  })

  it("draws a pin for each place the clusterer resolves", async () => {
    setPlaces({ places: [place(1), place(2)] })
    const { getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("btcmap-place-1")).toBeTruthy())
    expect(getByTestId("btcmap-place-2")).toBeTruthy()
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
})

describe("MapComponent adding a place", () => {
  it("offers it to a custodial account at level two", async () => {
    const { getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
  })

  it("does not offer it below account level two", async () => {
    // The backend refuses the submission for anything lower, so the button is
    // absent rather than present and failing at the end of a filled-in form.
    mockIsAtLeastLevelTwo = false
    const { queryByTestId, getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-place-search")).toBeTruthy())
    expect(queryByTestId("open-add-place")).toBeNull()
  })

  it("does not offer it to a self-custodial account", async () => {
    // The submission goes out through our backend on a Blink session, which a
    // self-custodial account does not have — so the button is absent rather
    // than present and failing at the end of a filled-in form.
    mockIsSelfCustodialAccount = true
    const { queryByTestId, getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-place-search")).toBeTruthy())
    expect(queryByTestId("open-add-place")).toBeNull()
  })

  it("does not offer it when nobody is signed in", async () => {
    mockIsAuthed = false
    const { queryByTestId, getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-place-search")).toBeTruthy())
    expect(queryByTestId("open-add-place")).toBeNull()
  })

  it("hands the map over to the pin, and takes the reading controls off it", async () => {
    // Searching and filtering are about reading the map; neither belongs over
    // one that is being aimed.
    const { getByTestId, queryByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
    fireEvent.press(getByTestId("open-add-place"))

    await waitFor(() => expect(getByTestId("confirm-place-location")).toBeTruthy())
    expect(queryByTestId("open-place-search")).toBeNull()
    expect(queryByTestId("open-category-filter")).toBeNull()
    expect(queryByTestId("open-add-place")).toBeNull()
  })

  it("gives the form the centre of the map the pin was left on", async () => {
    // The pin is drawn at the centre of the map view and never moves, so the
    // region's centre is where it is pointing — no measuring, no conversion.
    const { getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
    fireEvent.press(getByTestId("open-add-place"))

    const moved = { ...REGION, latitude: 13.496743, longitude: -89.439462 }
    act(() => {
      ;(capturedMapProps?.onRegionChangeComplete as (r: Region) => void)(moved)
    })
    fireEvent.press(getByTestId("confirm-place-location"))

    await waitFor(() => expect(capturedAddPlaceProps?.isVisible).toBe(true))
    expect(capturedAddPlaceProps?.location).toEqual({
      latitude: moved.latitude,
      longitude: moved.longitude,
    })
  })

  it("goes back to the map when the pin needs moving", async () => {
    const { getByTestId, queryByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
    fireEvent.press(getByTestId("open-add-place"))
    fireEvent.press(getByTestId("confirm-place-location"))

    await waitFor(() => expect(queryByTestId("confirm-place-location")).toBeNull())

    act(() => {
      ;(capturedAddPlaceProps?.onChangeLocation as () => void)()
    })

    await waitFor(() => expect(getByTestId("confirm-place-location")).toBeTruthy())
    expect(capturedAddPlaceProps?.isVisible).toBe(false)
  })

  it("abandons the whole thing on cancel", async () => {
    const { getByTestId, queryByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
    fireEvent.press(getByTestId("open-add-place"))
    fireEvent.press(getByTestId("cancel-add-place"))

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
    expect(queryByTestId("confirm-place-location")).toBeNull()
    expect(capturedAddPlaceProps?.isVisible).toBe(false)
  })

  it("leaves the pins alone while one is being placed", async () => {
    // A tap on the map is aiming at that point, not asking about what is
    // already on it.
    setPlaces({ places: [place(1)] })
    const { getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
    fireEvent.press(getByTestId("open-add-place"))
    fireEvent.press(getByTestId("btcmap-place-1"))

    await waitFor(() => expect(getByTestId("confirm-place-location")).toBeTruthy())
    expect(capturedSheetProps?.place).toBeNull()
  })

  it("closes the form and says thanks once BTC Map has the place", async () => {
    mockSubmitPlace.mockResolvedValue(true)
    const { getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
    fireEvent.press(getByTestId("open-add-place"))
    fireEvent.press(getByTestId("confirm-place-location"))

    await waitFor(() => expect(capturedAddPlaceProps?.isVisible).toBe(true))
    await act(async () => {
      await (capturedAddPlaceProps?.onSubmit as (s: unknown) => Promise<void>)({
        name: "Hope House",
        category: "cafes",
        latitude: REGION.latitude,
        longitude: REGION.longitude,
      })
    })

    expect(mockSubmitPlace).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Hope House", category: "cafes" }),
      expect.any(String),
    )
    await waitFor(() =>
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success" }),
      ),
    )
    await waitFor(() => expect(capturedAddPlaceProps?.isVisible).toBe(false))
  })

  it("keeps the form open when the place could not be sent, so a retry resends the same submission", async () => {
    // A retry of the same attempt must carry the same submissionId: that is
    // the idempotency key the backend deduplicates on.
    mockSubmitPlace.mockResolvedValue(false)
    const { getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
    fireEvent.press(getByTestId("open-add-place"))
    fireEvent.press(getByTestId("confirm-place-location"))

    await waitFor(() => expect(capturedAddPlaceProps?.isVisible).toBe(true))
    const submission = {
      name: "Hope House",
      category: "cafes",
      latitude: REGION.latitude,
      longitude: REGION.longitude,
    }
    const onSubmit = capturedAddPlaceProps?.onSubmit as (s: unknown) => Promise<void>

    await act(async () => {
      await onSubmit(submission)
    })

    await waitFor(() => expect(mockToastShow).toHaveBeenCalled())
    expect(mockToastShow).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    )
    expect(capturedAddPlaceProps?.isVisible).toBe(true)

    await act(async () => {
      await onSubmit(submission)
    })

    expect(mockSubmitPlace).toHaveBeenCalledTimes(2)
    expect(mockSubmitPlace.mock.calls[0][1]).toEqual(mockSubmitPlace.mock.calls[1][1])
  })

  it("mints a fresh submission id for a new attempt", async () => {
    mockSubmitPlace.mockResolvedValue(false)
    const { getByTestId } = renderMap()
    const submission = {
      name: "Hope House",
      category: "cafes",
      latitude: REGION.latitude,
      longitude: REGION.longitude,
    }

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
    fireEvent.press(getByTestId("open-add-place"))
    fireEvent.press(getByTestId("confirm-place-location"))

    await waitFor(() => expect(capturedAddPlaceProps?.isVisible).toBe(true))
    await act(async () => {
      await (capturedAddPlaceProps?.onSubmit as (s: unknown) => Promise<void>)(submission)
    })

    // Abandon the attempt and start another one.
    act(() => {
      ;(capturedAddPlaceProps?.onChangeLocation as () => void)()
    })
    fireEvent.press(getByTestId("cancel-add-place"))
    fireEvent.press(getByTestId("open-add-place"))
    fireEvent.press(getByTestId("confirm-place-location"))

    await waitFor(() => expect(capturedAddPlaceProps?.isVisible).toBe(true))
    await act(async () => {
      await (capturedAddPlaceProps?.onSubmit as (s: unknown) => Promise<void>)(submission)
    })

    expect(mockSubmitPlace).toHaveBeenCalledTimes(2)
    expect(mockSubmitPlace.mock.calls[0][1]).not.toEqual(mockSubmitPlace.mock.calls[1][1])
  })
})

describe("MapComponent add-place drafts", () => {
  const startAndConfirm = (getByTestId: (id: string) => unknown) => {
    fireEvent.press(getByTestId("open-add-place") as never)
    fireEvent.press(getByTestId("confirm-place-location") as never)
  }

  it("keeps what has been typed while the pin is moved", async () => {
    // Going back to the map corrects one of the answers rather than starting
    // again, so the form that comes back is the same one, still filled in.
    const { getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
    startAndConfirm(getByTestId)

    await waitFor(() => expect(capturedAddPlaceProps?.isVisible).toBe(true))
    const mountsBefore = addPlaceMountCount

    act(() => {
      ;(capturedAddPlaceProps?.onChangeLocation as () => void)()
    })
    fireEvent.press(getByTestId("confirm-place-location"))

    await waitFor(() => expect(capturedAddPlaceProps?.isVisible).toBe(true))
    expect(addPlaceMountCount).toBe(mountsBefore)
  })

  it("does not carry an abandoned place into the next one", async () => {
    // Backing out to the map and then cancelling abandons the place. What had
    // been typed about it must not turn up in the next attempt.
    const { getByTestId } = renderMap()

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
    startAndConfirm(getByTestId)

    await waitFor(() => expect(capturedAddPlaceProps?.isVisible).toBe(true))
    const mountsBefore = addPlaceMountCount

    act(() => {
      ;(capturedAddPlaceProps?.onChangeLocation as () => void)()
    })
    fireEvent.press(getByTestId("cancel-add-place"))

    await waitFor(() => expect(getByTestId("open-add-place")).toBeTruthy())
    startAndConfirm(getByTestId)

    await waitFor(() => expect(capturedAddPlaceProps?.isVisible).toBe(true))
    expect(addPlaceMountCount).toBeGreaterThan(mountsBefore)
  })
})
