import React from "react"
import { Linking, Share, StyleSheet } from "react-native"
import type { ReactTestInstance } from "react-test-renderer"
import { getAnimatedStyle } from "react-native-reanimated"
import { act, render, fireEvent, waitFor, within } from "@testing-library/react-native"

import { BtcMapPlace, BtcMapPlaceDetails } from "@app/btcmap"
import { useBtcMapPlaceDetails } from "@app/btcmap/use-place-details"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { PlaceSheet } from "@app/components/map-component/place-sheet"
import { openExternalUrl } from "@app/utils/external"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../../screens/helper"

jest.mock("@app/btcmap/use-place-details", () => ({
  useBtcMapPlaceDetails: jest.fn(),
}))

jest.mock("@app/utils/external", () => ({ openExternalUrl: jest.fn() }))

// Read lazily so a test can raise the home-indicator inset before rendering.
let mockBottomInset = 0
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: mockBottomInset, left: 0, right: 0 }),
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

// The sheet is painted this much taller than the height its animation is
// measured against, so its antialiased bottom edge falls below the screen —
// see BOTTOM_OVERHANG in the component.
const BOTTOM_OVERHANG = 1

/** The height the sheet's offsets are expressed in, not the one it is drawn at. */
const animatedHeightOf = (sheet: ReactTestInstance) =>
  (StyleSheet.flatten(sheet.props.style).height as number) - BOTTOM_OVERHANG

const renderSheet = (props: Partial<React.ComponentProps<typeof PlaceSheet>> = {}) =>
  render(
    <ContextForScreen>
      <PlaceSheet place={LONDON_PLACE} onClose={jest.fn()} {...props} />
    </ContextForScreen>,
  )

beforeEach(() => {
  jest.clearAllMocks()
  mockBottomInset = 0
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

  it("shares the place's page on btcmap.org, keyed by its OSM id", async () => {
    setDetails(details({ osmId: "node:12607455734" }))
    const { getByTestId } = renderSheet()

    // Share is an icon beside the name now, so it is reached by its label.
    await waitFor(() => expect(getByTestId("share-place")).toBeTruthy())
    fireEvent.press(getByTestId("share-place"))

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

  it("opens at the lower rest position, with Navigate already showing", async () => {
    // The point of the two-stop sheet: the action most people came for is under
    // their thumb before they have read anything or dragged anywhere.
    const { getByTestId, getByText } = renderSheet()

    await waitFor(() => expect(getByText("Satoshi Coffee")).toBeTruthy())

    const peek = getByTestId("place-sheet-peek")
    expect(within(peek).getByText("Navigate")).toBeTruthy()
    expect(within(peek).getByText("Satoshi Coffee")).toBeTruthy()
  })

  it("presses the app's own buttons into service rather than restyling a Pressable", async () => {
    // Navigate and Close are the shared primary and secondary buttons, so the
    // pill radius, the on-primary title colour, the disabled and loading states
    // and the press feedback all arrive from the theme. A local copy of any of
    // that is a copy that drifts.
    const tree = renderSheet()

    await waitFor(() => expect(tree.getByText("Satoshi Coffee")).toBeTruthy())

    // eslint-disable-next-line camelcase -- testing-library exposes this verbatim
    expect(tree.UNSAFE_getByType(GaloyPrimaryButton).props.title).toBe("Navigate")
    // eslint-disable-next-line camelcase -- testing-library exposes this verbatim
    expect(tree.UNSAFE_getByType(GaloySecondaryButton).props.title).toBe("Close")
  })

  it("stays off screen until the peek has been measured, rather than guessing", async () => {
    // No layout event has fired yet, so there is nothing to derive the snap
    // point from — the sheet waits below the screen instead of opening to a
    // made-up height and hopping once the real one lands.
    const { getByTestId, getByText } = renderSheet()

    await waitFor(() => expect(getByText("Satoshi Coffee")).toBeTruthy())

    const sheet = getByTestId("place-sheet")
    expect(getAnimatedStyle(sheet)).toMatchObject({
      transform: [{ translateY: animatedHeightOf(sheet) }],
    })
  })

  it("rests on the peek's bottom edge, clear of the home indicator", async () => {
    jest.useFakeTimers()
    try {
      mockBottomInset = 34
      const { getByTestId } = renderSheet()
      const sheet = getByTestId("place-sheet")
      const sheetHeight = animatedHeightOf(sheet)

      // The indicator is cleared by padding inside the peek, so the snap point
      // does not lift for it: a sheet resting higher than the peek's own edge
      // uncovers the top of the row behind it, and half a row of contact detail
      // sliced by the screen edge reads as a rendering fault.
      const peek = getByTestId("place-sheet-peek")
      expect(StyleSheet.flatten(peek.props.style).paddingBottom).toBe(14 + 34)

      fireEvent(peek, "layout", {
        nativeEvent: { layout: { x: 0, y: 24, width: 375, height: 200 } },
      })
      // Run the opening spring to rest.
      await act(async () => {
        jest.advanceTimersByTime(3000)
      })

      // The snap point is the peek's bottom edge — y + height, since the handle
      // and padding above it show inside the window too, so its bare height is
      // not enough — and nothing beyond it.
      expect(getAnimatedStyle(sheet)).toMatchObject({
        transform: [{ translateY: sheetHeight - (24 + 200) }],
      })

      // A peek measured taller than the sheet can show stops at fully open
      // rather than pushing the sheet's top edge off the screen's.
      fireEvent(getByTestId("place-sheet-peek"), "layout", {
        nativeEvent: { layout: { x: 0, y: 24, width: 375, height: sheetHeight * 2 } },
      })
      await act(async () => {
        jest.advanceTimersByTime(3000)
      })

      expect(getAnimatedStyle(sheet)).toMatchObject({ transform: [{ translateY: 0 }] })
    } finally {
      jest.useRealTimers()
    }
  })

  it("hangs its bottom edge below the screen, so no seam shows under it", async () => {
    // The sheet's outer shape is a rounded path, which Android antialiases on
    // every edge including the straight bottom one. Three of those edges hide
    // the half-lit pixel under a border; the bottom has none, and what showed
    // through it was a hairline of scrim between the sheet and the screen.
    const { getByTestId } = renderSheet()
    const sheet = getByTestId("place-sheet")
    const style = StyleSheet.flatten(sheet.props.style)

    // Nothing has been measured yet, so the sheet is parked one full offset
    // down — which makes that offset the height it is animated against, read
    // back off reanimated rather than restated here. It is a pixel short of the
    // height the sheet is drawn at...
    expect(getAnimatedStyle(sheet)).toMatchObject({
      transform: [{ translateY: (style.height as number) - BOTTOM_OVERHANG }],
    })
    // ...and the sheet is pulled down by that same pixel, so the overhang lands
    // off the bottom of the screen and nothing on the sheet moves to pay for it.
    expect(style.marginBottom).toBe(-BOTTOM_OVERHANG)
  })

  it("credits BTC Map and OpenStreetMap, which the data's licence requires", async () => {
    // The credit moved here off the map, where the system's largest font size
    // grew it over the streets it was crediting.
    const { getByTestId } = renderSheet()

    await waitFor(() => expect(getByTestId("place-sheet-attribution")).toBeTruthy())
    const credit = within(getByTestId("place-sheet-attribution"))

    fireEvent.press(credit.getByText("BTC Map"))
    expect(mockedOpenExternal).toHaveBeenCalledWith("https://btcmap.org")

    fireEvent.press(credit.getByText("OpenStreetMap"))
    expect(mockedOpenExternal).toHaveBeenCalledWith(
      "https://www.openstreetmap.org/copyright",
    )
  })

  it("locks the list until the sheet is dragged up", async () => {
    // Below full height a drag has to resize the sheet. A scroll view that took
    // it instead would swallow the gesture on a list with nowhere to go.
    const { getByTestId, getByText } = renderSheet()

    await waitFor(() => expect(getByText("Satoshi Coffee")).toBeTruthy())
    expect(getByTestId("place-sheet-scroll").props.scrollEnabled).toBe(false)
  })

  it("shows where and when in the block the lower position rests on", async () => {
    // Where the place is and when it is open are read on the way to deciding
    // whether to set off, so they sit with Navigate. The ways to reach it are
    // not, so they wait behind a drag.
    setDetails(
      details({
        openingHours: "24/7",
        phone: "+44 20 7946 0100",
        address: "1 Bishopsgate",
      }),
    )
    const { getByTestId, getByText } = renderSheet()

    await waitFor(() => expect(getByText("Satoshi Coffee")).toBeTruthy())

    const peek = getByTestId("place-sheet-peek")
    expect(within(peek).getByText("1 Bishopsgate")).toBeTruthy()
    expect(within(peek).getByText("24/7")).toBeTruthy()
    expect(within(peek).queryByText("+44 20 7946 0100")).toBeNull()
  })

  it("closes from the button at the foot of the detail", async () => {
    // Dragging down closes it too, but that is a gesture you have to know
    // about — this is the same thing spelled out, past the last of the detail.
    const onClose = jest.fn()
    const { getByTestId, getByText } = renderSheet({ onClose })

    await waitFor(() => expect(getByText("Satoshi Coffee")).toBeTruthy())

    // Not in the block the lower rest position shows: it belongs at the end of
    // the detail, not next to Navigate.
    expect(within(getByTestId("place-sheet-peek")).queryByText("Close")).toBeNull()

    fireEvent.press(getByTestId("close-place-sheet"))
    expect(onClose).toHaveBeenCalled()
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

describe("PlaceSheet contact and payment rows", () => {
  it("dials, mails and pays through the OS rather than the in-app browser", async () => {
    // InAppBrowser cannot open tel:, mailto: or lightning: — those have to
    // reach the platform handler.
    setDetails(details({ phone: "+44 20 7946 0100", email: "hi@satoshi.example" }))
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("+44 20 7946 0100")).toBeTruthy())
    fireEvent.press(getByText("+44 20 7946 0100"))
    expect(Linking.openURL).toHaveBeenCalledWith("tel:+44 20 7946 0100")

    fireEvent.press(getByText("hi@satoshi.example"))
    expect(Linking.openURL).toHaveBeenCalledWith("mailto:hi@satoshi.example")
  })

  it("refuses to hand a merchant's own scheme to the OS from a link row", async () => {
    // These fields are raw OSM tags any volunteer can edit, and this app is the
    // registered handler for bitcoin:, lightning:, lnurlp: and blink:. A pin
    // must not be able to reopen our own send flow from behind a globe icon.
    setDetails(
      details({
        website: "bitcoin:bc1qattacker?amount=1",
        requiredAppUrl: "lnurlp:pay@evil.example",
        // eslint-disable-next-line no-script-url -- the point of the test
        instagram: "javascript:alert(1)",
      }),
    )
    const { getByText, queryByText } = renderSheet()

    await waitFor(() => expect(getByText("Satoshi Coffee")).toBeTruthy())

    // Not merely inert — never drawn, so there is no tap that goes somewhere
    // other than what its icon and label promise.
    expect(queryByText("bc1qattacker")).toBeNull()
    expect(queryByText("Needs a specific app to pay")).toBeNull()
    expect(queryByText("Instagram")).toBeNull()
    expect(Linking.openURL).not.toHaveBeenCalled()
    expect(mockedOpenExternal).not.toHaveBeenCalled()
  })

  it("still shows a number it will not dial, rather than hiding it", async () => {
    // "*21*<number>#" forwards every call. The number is worth reading; putting
    // it one tap from the dialer is not.
    setDetails(details({ phone: "*21*15550100#" }))
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("*21*15550100#")).toBeTruthy())
    fireEvent.press(getByText("*21*15550100#"))

    expect(Linking.openURL).not.toHaveBeenCalled()
  })

  it("opens the links that are what they claim to be", async () => {
    setDetails(
      details({
        website: "satoshi.example/menu",
        requiredAppUrl: "https://wallet.example",
        instagram: "@satoshi",
      }),
    )
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("satoshi.example")).toBeTruthy())
    fireEvent.press(getByText("satoshi.example"))
    expect(mockedOpenExternal).toHaveBeenCalledWith("https://satoshi.example/menu")

    // On the companion-app card the sentence is prose; the URL under it is the
    // part that opens.
    fireEvent.press(getByText("wallet.example"))
    expect(mockedOpenExternal).toHaveBeenCalledWith("https://wallet.example")

    fireEvent.press(getByText("Instagram"))
    expect(mockedOpenExternal).toHaveBeenCalledWith("https://instagram.com/satoshi")
  })

  it("offers the pay row only when the place published a payment URI", async () => {
    const without = renderSheet()
    await waitFor(() => expect(without.getByText("Satoshi Coffee")).toBeTruthy())
    expect(without.queryByText("Pay this merchant")).toBeNull()

    setDetails(details({ paymentUrl: "lightning:lnurl1abc" }))
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("Pay this merchant")).toBeTruthy())
    fireEvent.press(getByText("Pay this merchant"))

    // Handed to the OS verbatim — the allowlist in api.ts is what vets it.
    expect(Linking.openURL).toHaveBeenCalledWith("lightning:lnurl1abc")
  })

  it("warns on a card, beside Navigate, when paying needs a particular app", async () => {
    // "You cannot pay here with this wallet" has to be readable before setting
    // off, so the card sits in the block the lower rest position shows rather
    // than down among the contact rows.
    setDetails(details({ requiredAppUrl: "www.moneybadger.co.za/pay" }))
    const { getByTestId } = renderSheet()

    await waitFor(() => expect(getByTestId("requires-app-card")).toBeTruthy())

    const card = within(getByTestId("requires-app-card"))
    // Substring match: the message and the link are one Text tree inside the
    // standard GaloyInfo box, so no node carries the message text alone.
    expect(card.getByText("Needs a specific app to pay", { exact: false })).toBeTruthy()
    // Shown without the scheme, but still the whole path.
    expect(card.getByText("www.moneybadger.co.za/pay")).toBeTruthy()

    expect(
      within(getByTestId("place-sheet-peek")).getByTestId("requires-app-card"),
    ).toBeTruthy()

    fireEvent.press(card.getByText("www.moneybadger.co.za/pay"))
    expect(mockedOpenExternal).toHaveBeenCalledWith("https://www.moneybadger.co.za/pay")
  })

  it("shares by numeric id before the details have arrived", async () => {
    // The OSM id comes with the details; sharing before then still has to
    // produce a link that resolves, which the place's own id does.
    setDetails(null, { isLoading: true })
    const { getByTestId } = renderSheet()

    await waitFor(() => expect(getByTestId("share-place")).toBeTruthy())
    fireEvent.press(getByTestId("share-place"))

    expect(Share.share).toHaveBeenCalledWith({
      message: "https://btcmap.org/merchant/42",
    })
  })

  it("re-reads the clock so a place closing under the user stops saying open", async () => {
    jest.useFakeTimers()
    try {
      // Open until 18:00; start at 17:59 and cross the boundary.
      jest.setSystemTime(new Date(2026, 7, 12, 17, 59))
      setDetails(details({ openingHours: "Mo-Su 09:00-18:00" }))
      const { getByText, queryByText } = renderSheet({ userLocation: NEARBY_USER })

      await waitFor(() => expect(getByText("Open now")).toBeTruthy())

      await act(async () => {
        jest.setSystemTime(new Date(2026, 7, 12, 18, 1))
        jest.advanceTimersByTime(60_000)
      })

      expect(queryByText("Open now")).toBeNull()
      expect(getByText("Closed")).toBeTruthy()
    } finally {
      jest.useRealTimers()
    }
  })
})
