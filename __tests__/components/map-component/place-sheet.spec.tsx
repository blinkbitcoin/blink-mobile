import React from "react"
import { Linking, Share } from "react-native"
import { render, fireEvent, waitFor } from "@testing-library/react-native"

import { BtcMapPlace, BtcMapPlaceDetails } from "@app/btcmap"
import { useBtcMapPlaceDetails } from "@app/btcmap/use-place-details"
import { PlaceSheet } from "@app/components/map-component/place-sheet"
import { openExternalUrl } from "@app/utils/external"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../../screens/helper"

jest.mock("@app/btcmap/use-place-details", () => ({
  useBtcMapPlaceDetails: jest.fn(),
}))

jest.mock("@app/utils/external", () => ({ openExternalUrl: jest.fn() }))

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockedUseDetails = useBtcMapPlaceDetails as jest.MockedFunction<
  typeof useBtcMapPlaceDetails
>
const mockedOpenExternal = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>

const LONDON_PLACE: BtcMapPlace = {
  id: 42,
  latitude: 51.5072,
  longitude: -0.1276,
  icon: "local_cafe",
}

const NEARBY_USER = { latitude: 51.51, longitude: -0.13 }
const TOKYO_USER = { latitude: 35.6762, longitude: 139.6503 }

const details = (overrides: Partial<BtcMapPlaceDetails> = {}): BtcMapPlaceDetails => ({
  id: 42,
  name: "Satoshi Coffee",
  address: "1 Bishopsgate, London",
  acceptsLightning: false,
  acceptsOnchain: false,
  acceptsContactless: false,
  ...overrides,
})

const setDetails = (value: BtcMapPlaceDetails | null, extra = {}) => {
  mockedUseDetails.mockReturnValue({
    details: value,
    isLoading: false,
    hasError: false,
    retry: jest.fn(),
    ...extra,
  })
}

const renderSheet = (props: Partial<React.ComponentProps<typeof PlaceSheet>> = {}) =>
  render(
    <ContextForScreen>
      <PlaceSheet place={LONDON_PLACE} onClose={jest.fn()} {...props} />
    </ContextForScreen>,
  )

beforeEach(() => {
  jest.clearAllMocks()
  loadLocale("en")
  jest.spyOn(Linking, "openURL").mockResolvedValue(true)
  mockedOpenExternal.mockResolvedValue(undefined)
  jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" })
  setDetails(details())
})

describe("PlaceSheet", () => {
  it("renders nothing until a place is selected", () => {
    const { queryByText } = renderSheet({ place: null })
    expect(queryByText("Satoshi Coffee")).toBeNull()
  })

  it("shows the place's name and address", async () => {
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("Satoshi Coffee")).toBeTruthy())
    expect(getByText("1 Bishopsgate, London")).toBeTruthy()
  })

  it("shows the raw opening hours whether or not it can judge them", async () => {
    setDetails(details({ openingHours: "by appointment only" }))
    const { getByText } = renderSheet({ userLocation: NEARBY_USER })

    await waitFor(() => expect(getByText("by appointment only")).toBeTruthy())
    expect(() => getByText("Open now")).toThrow()
    expect(() => getByText("Closed")).toThrow()
  })

  it("judges opening hours for a place in the user's own timezone", async () => {
    setDetails(details({ openingHours: "24/7" }))
    const { getByText } = renderSheet({ userLocation: NEARBY_USER })

    await waitFor(() => expect(getByText("Open now")).toBeTruthy())
  })

  it("stays quiet about opening hours for a place on the other side of the world", async () => {
    // The device clock is not the merchant's clock, and we have no way to know
    // theirs — so no badge rather than a confidently wrong one.
    setDetails(details({ openingHours: "24/7" }))
    const { getByText, queryByText } = renderSheet({ userLocation: TOKYO_USER })

    await waitFor(() => expect(getByText("Satoshi Coffee")).toBeTruthy())
    expect(queryByText("Open now")).toBeNull()
  })

  it("stays quiet about opening hours when the user's location is unknown", async () => {
    setDetails(details({ openingHours: "24/7" }))
    const { getByText, queryByText } = renderSheet()

    await waitFor(() => expect(getByText("Satoshi Coffee")).toBeTruthy())
    expect(queryByText("Open now")).toBeNull()
  })

  it("distinguishes a fresh survey from a stale one from none at all", async () => {
    const thisYear = new Date()
    thisYear.setMonth(thisYear.getMonth() - 1)
    setDetails(details({ verifiedAt: thisYear.toISOString().slice(0, 10) }))
    const fresh = renderSheet()
    await waitFor(() => expect(fresh.getByText(/^Verified /)).toBeTruthy())

    setDetails(details({ verifiedAt: "2019-03-13" }))
    const stale = renderSheet()
    await waitFor(() => expect(stale.getByText(/^Last verified /)).toBeTruthy())

    setDetails(details())
    const never = renderSheet()
    await waitFor(() =>
      expect(never.getByText("This location needs to be surveyed")).toBeTruthy(),
    )
  })

  it("lists the payment methods the place actually advertises", async () => {
    setDetails(details({ acceptsLightning: true, acceptsContactless: true }))
    const { getByText, queryByText } = renderSheet()

    await waitFor(() => expect(getByText("Lightning")).toBeTruthy())
    expect(getByText("Contactless")).toBeTruthy()
    expect(queryByText("Onchain")).toBeNull()
  })

  it("shares the place's page on btcmap.org, keyed by its OSM id", async () => {
    setDetails(details({ osmId: "node:12607455734" }))
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("Share")).toBeTruthy())
    fireEvent.press(getByText("Share"))

    expect(Share.share).toHaveBeenCalledWith({
      message: "https://btcmap.org/merchant/node:12607455734",
    })
  })

  it("opens a bare domain as https rather than handing the OS a schemeless string", async () => {
    setDetails(details({ website: "www.satoshicoffee.example/menu" }))
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("satoshicoffee.example")).toBeTruthy())
    fireEvent.press(getByText("satoshicoffee.example"))

    // Web links use the in-app browser the rest of the app uses.
    expect(mockedOpenExternal).toHaveBeenCalledWith(
      "https://www.satoshicoffee.example/menu",
    )
  })

  it("offers a retry when the details request failed", async () => {
    const retry = jest.fn()
    setDetails(null, { hasError: true, retry })
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("Couldn't load this place")).toBeTruthy())
    fireEvent.press(getByText("Try Again"))

    expect(retry).toHaveBeenCalled()
  })
})

describe("PlaceSheet fallbacks", () => {
  it("names an unnamed place instead of pulsing a skeleton at it forever", async () => {
    // The skeleton is a loading state; a loaded place with no name and a failed
    // fetch are both terminal, and neither should animate indefinitely.
    setDetails(details({ name: undefined }))
    const loaded = renderSheet()
    await waitFor(() => expect(loaded.getByText("Unnamed place")).toBeTruthy())

    setDetails(null, { hasError: true })
    const failed = renderSheet()
    await waitFor(() => expect(failed.getByText("Unnamed place")).toBeTruthy())
  })

  it("turns a bare OSM social handle into a reachable profile URL", async () => {
    // OSM stores contact:instagram as a handle about half the time; prefixing
    // https:// to "@name" yields a URL that resolves to nothing.
    setDetails(details({ instagram: "@satoshicoffee", facebook: "satoshi.coffee" }))
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("Instagram")).toBeTruthy())
    fireEvent.press(getByText("Instagram"))
    expect(mockedOpenExternal).toHaveBeenCalledWith("https://instagram.com/satoshicoffee")

    fireEvent.press(getByText("Facebook"))
    expect(mockedOpenExternal).toHaveBeenCalledWith("https://satoshi.coffee")
  })

  it("passes a social value that is already a URL through untouched", async () => {
    setDetails(details({ twitter: "https://x.com/satoshicoffee" }))
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("X")).toBeTruthy())
    fireEvent.press(getByText("X"))

    expect(mockedOpenExternal).toHaveBeenCalledWith("https://x.com/satoshicoffee")
  })

  it("navigates by coordinate when the place has no name to label the pin with", async () => {
    // An empty label turns the maps: URL into a text search that finds nothing.
    setDetails(details({ name: undefined }))
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("Navigate")).toBeTruthy())
    fireEvent.press(getByText("Navigate"))

    // geo:/maps: must reach the OS — the in-app browser cannot open them.
    const url = (Linking.openURL as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain("51.5072")
    expect(url).not.toContain("()")
    expect(url).not.toContain("@51.5072")
  })
})
