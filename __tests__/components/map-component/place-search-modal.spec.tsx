import React from "react"
import { Modal } from "react-native"
import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { BtcMapNamedPlace, PlaceCategory } from "@app/btcmap"
import { useBtcMapPlaceSearch } from "@app/btcmap/use-place-search"
import { PlaceSearchModal } from "@app/components/map-component/place-search-modal"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../../screens/helper"

jest.mock("@app/btcmap/use-place-search", () => ({ useBtcMapPlaceSearch: jest.fn() }))

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockedSearch = useBtcMapPlaceSearch as jest.MockedFunction<
  typeof useBtcMapPlaceSearch
>

const CENTER = { latitude: 51.5, longitude: -0.12 }
// Standing right where the map is centred, so the fixtures' offsets are also
// their distances from the phone.
const USER = CENTER

// Roughly `metres` north of the centre of the map.
const at = (
  id: number,
  name: string,
  {
    metres,
    icon = "restaurant",
    address,
  }: { metres: number; icon?: string; address?: string },
) => ({
  id,
  name,
  icon,
  address,
  latitude: CENTER.latitude + metres / 111_320,
  longitude: CENTER.longitude,
})

const NEARBY = [
  at(1, "Satoshi Burgers", { metres: 200, address: "1 Bishopsgate, London" }),
  at(2, "Arts and Crafts", { metres: 600, icon: "palette" }),
]

const mockRetry = jest.fn()

const setSearch = (overrides: Partial<ReturnType<typeof useBtcMapPlaceSearch>> = {}) =>
  mockedSearch.mockReturnValue({
    places: NEARBY as BtcMapNamedPlace[],
    isLoading: false,
    hasError: false,
    retry: mockRetry,
    ...overrides,
  })

const renderModal = (
  props: Partial<React.ComponentProps<typeof PlaceSearchModal>> = {},
) =>
  render(
    <ContextForScreen>
      <PlaceSearchModal
        isVisible
        center={CENTER}
        userLocation={USER}
        viewportRadiusKm={8}
        categories={new Set<PlaceCategory>()}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        {...props}
      />
    </ContextForScreen>,
  )

beforeEach(() => {
  jest.clearAllMocks()
  loadLocale("en")
  setSearch()
})

describe("PlaceSearchModal", () => {
  it("lists what is nearby before anything is typed, nearest first", async () => {
    const { getByText, getAllByText } = renderModal()

    await waitFor(() => expect(getByText("Satoshi Burgers")).toBeTruthy())
    expect(getByText("200 meters away")).toBeTruthy()
    expect(getByText("0.6 km away")).toBeTruthy()

    const names = getAllByText(/Satoshi Burgers|Arts and Crafts/).map(
      (node) => node.props.children,
    )
    expect(names).toEqual(["Satoshi Burgers", "Arts and Crafts"])
  })

  it("measures from the phone, not from the middle of the map", async () => {
    // Someone who has panned across town is still standing where they are
    // standing, and "away" has to mean away from them.
    const { getByText } = renderModal({
      center: { latitude: 51.6, longitude: -0.12 },
    })

    await waitFor(() => expect(getByText("Satoshi Burgers")).toBeTruthy())
    expect(getByText("200 meters away")).toBeTruthy()
  })

  it("falls back to the address when the phone will not say where it is", async () => {
    const { getByText, queryByText } = renderModal({ userLocation: undefined })

    await waitFor(() => expect(getByText("Satoshi Burgers")).toBeTruthy())
    expect(getByText("1 Bishopsgate, London")).toBeTruthy()
    // A distance from the middle of the map is not the distance the row claims.
    expect(queryByText("200 meters away")).toBeNull()
  })

  it("says nothing rather than something wrong when there is no address either", async () => {
    const { getByText, queryByText } = renderModal({ userLocation: undefined })

    await waitFor(() => expect(getByText("Arts and Crafts")).toBeTruthy())
    expect(queryByText("0.6 km away")).toBeNull()
  })

  it("narrows the list as the name is typed", async () => {
    const { getByTestId, getByText, queryByText } = renderModal()

    await waitFor(() => expect(getByText("Arts and Crafts")).toBeTruthy())
    fireEvent.changeText(getByTestId("place-search-input"), "sato")

    expect(getByText("Satoshi Burgers")).toBeTruthy()
    expect(queryByText("Arts and Crafts")).toBeNull()
  })

  it("says so when nothing matches", async () => {
    const { getByTestId, getByText } = renderModal()

    await waitFor(() => expect(getByText("Satoshi Burgers")).toBeTruthy())
    fireEvent.changeText(getByTestId("place-search-input"), "Foooo")

    expect(getByText("Nothing to show")).toBeTruthy()
  })

  it("does not claim there is nothing here while it is still looking", async () => {
    setSearch({ places: [], isLoading: true })
    const { queryByText } = renderModal()

    await waitFor(() => expect(mockedSearch).toHaveBeenCalled())
    expect(queryByText("Nothing to show")).toBeNull()
  })

  it("offers a retry when the area could not be searched", async () => {
    setSearch({ places: [], hasError: true })
    const { getByText } = renderModal()

    await waitFor(() => expect(getByText("Couldn't search this area")).toBeTruthy())
    fireEvent.press(getByText("Try Again"))

    expect(mockRetry).toHaveBeenCalled()
  })

  it("shows only what the map's own filter is showing", async () => {
    // The list sits over a filtered map; contradicting it would be worse than
    // showing less.
    const { getByText, queryByText } = renderModal({
      categories: new Set<PlaceCategory>(["shops"]),
    })

    await waitFor(() => expect(getByText("Arts and Crafts")).toBeTruthy())
    expect(queryByText("Satoshi Burgers")).toBeNull()
  })

  it("hands the picked place back to the map", async () => {
    const onSelect = jest.fn()
    const { getByTestId } = renderModal({ onSelect })

    await waitFor(() => expect(getByTestId("search-result-1")).toBeTruthy())
    fireEvent.press(getByTestId("search-result-1"))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })

  it("clears what was typed first, and only then closes", async () => {
    // One control for the one thing left to undo — the typed query while there
    // is one, the search itself once there is not.
    const onClose = jest.fn()
    const { getByTestId, getByText } = renderModal({ onClose })

    await waitFor(() => expect(getByTestId("place-search-input")).toBeTruthy())
    fireEvent.changeText(getByTestId("place-search-input"), "sato")

    fireEvent.press(getByTestId("clear-place-search"))
    expect(onClose).not.toHaveBeenCalled()
    expect(getByText("Arts and Crafts")).toBeTruthy()

    fireEvent.press(getByTestId("clear-place-search"))
    expect(onClose).toHaveBeenCalled()
  })

  it("asks for nothing while it is closed", () => {
    renderModal({ isVisible: false })

    expect(mockedSearch).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
  })

  it("reports its actual dismissal, which is when iOS can present the next modal", async () => {
    // The map opens the place sheet off this signal; if it stops reaching the
    // native modal, a search pick on iOS flies the map but never opens a sheet.
    const onDismiss = jest.fn()
    const view = renderModal({ onDismiss })

    await waitFor(() => expect(view.UNSAFE_getByType(Modal)).toBeTruthy())
    view.UNSAFE_getByType(Modal).props.onDismiss?.()

    expect(onDismiss).toHaveBeenCalled()
  })
})
