import React from "react"
import type { ReactTestRendererJSON } from "react-test-renderer"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import LocationButtonCopy from "@app/components/map-component/location-button-copy"
import { PlaceLocator, locatorBarTop } from "@app/components/map-component/place-locator"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"

import { ContextForScreen } from "../../screens/helper"

// Same native-module stand-in the map spec uses: LocationButtonCopy imports
// react-native-permissions, which has no TurboModule behind it in tests.
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

// The button needs the theme and nothing else — the style being asserted is on
// its root view, which a bare ThemeProvider keeps at the root of the tree.
const withTheme = (node: React.ReactElement) => (
  <ThemeProvider theme={theme}>{node}</ThemeProvider>
)

/** The root host node's props — `toJSON` types itself as possibly several. */
const rootProps = (tree: ReactTestRendererJSON | ReactTestRendererJSON[] | null) =>
  tree && !Array.isArray(tree) ? tree.props : undefined

const renderLocator = (props: Partial<React.ComponentProps<typeof PlaceLocator>> = {}) =>
  render(
    <ContextForScreen>
      <PlaceLocator onConfirm={jest.fn()} onCancel={jest.fn()} {...props} />
    </ContextForScreen>,
  )

beforeEach(() => {
  loadLocale("en")
})

describe("PlaceLocator", () => {
  it("says how the pin works while it is being aimed", () => {
    const { getByText } = renderLocator()

    expect(getByText("Move the map to put the pin on the place")).toBeTruthy()
  })

  it("confirms and cancels through its own bar", () => {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()
    const { getByTestId } = renderLocator({ onConfirm, onCancel })

    fireEvent.press(getByTestId("confirm-place-location"))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    fireEvent.press(getByTestId("cancel-add-place"))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe("locatorBarTop", () => {
  it("clears the licence credit and the bar, whatever the home-indicator inset", () => {
    // bottomInset + 34 (the ODbL credit's gap) + 50 (the bar): anything raised
    // by this much sits on the bar, never in it — the location button is the
    // one thing that stays reachable while the pin is being aimed.
    expect(locatorBarTop(0)).toBe(84)
    expect(locatorBarTop(24)).toBe(108)
  })
})

describe("LocationButtonCopy", () => {
  it("takes the bottom it is given while the locator's bar has the map's", () => {
    // Without the hand-off the button would sit inside the bar: same corner,
    // same height. The style lives on the outer view, so that is what is read.
    const { toJSON } = render(
      withTheme(
        <LocationButtonCopy
          requestPermissions={jest.fn()}
          centerOnUser={jest.fn()}
          bottom={locatorBarTop(24) + 10}
        />,
      ),
    )

    expect(rootProps(toJSON())?.style).toMatchObject({ bottom: 118 })
  })

  it("keeps its default height over the licence credit otherwise", () => {
    const { toJSON } = render(
      withTheme(
        <LocationButtonCopy requestPermissions={jest.fn()} centerOnUser={jest.fn()} />,
      ),
    )

    expect(rootProps(toJSON())?.style).toMatchObject({ bottom: 48 })
  })
})
