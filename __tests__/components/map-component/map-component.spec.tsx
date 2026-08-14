import React from "react"
import { Region } from "react-native-maps"
import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { BtcMapPlace, useBtcMapPlaces } from "@app/btcmap"
import MapComponent from "@app/components/map-component"
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

jest.mock("react-native-maps", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  const MapView = ReactActual.forwardRef(
    ({ children }: { children?: React.ReactNode }, _ref: React.Ref<unknown>) =>
      ReactActual.createElement(RN.View, { testID: "map-view" }, children),
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

const mockedPlaces = useBtcMapPlaces as jest.MockedFunction<typeof useBtcMapPlaces>
const mockedGetUserRegion = getUserRegion as jest.MockedFunction<typeof getUserRegion>

const REGION: Region = {
  latitude: 51.5,
  longitude: -0.12,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
}

const place = (id: number): BtcMapPlace => ({
  id,
  latitude: 51.5 + id / 10000,
  longitude: -0.12,
  icon: "local_cafe",
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
