import React from "react"
import { Path } from "react-native-svg"
import { render } from "@testing-library/react-native"

import { PlaceLocator } from "@app/components/map-component/place-locator"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../../screens/helper"

beforeEach(() => {
  loadLocale("en")
})

describe("PlaceLocator", () => {
  it("says how the pin works while it is being aimed", () => {
    const { getByText } = render(
      <ContextForScreen>
        <PlaceLocator />
      </ContextForScreen>,
    )

    expect(getByText("Move the map to put the pin on the place")).toBeTruthy()
  })

  it("takes no touches, so the map underneath keeps every one of them", () => {
    // The pin is drawn over a map that is still being panned to aim it. A view
    // that swallowed touches would take them from the gesture it exists to
    // describe, and there is nothing on it to tap.
    const { getByTestId } = render(
      <ContextForScreen>
        <PlaceLocator />
      </ContextForScreen>,
    )

    expect(getByTestId("place-pin").props.pointerEvents).toBe("none")
  })

  it("is blue in a white ring, so it is not read as a place already listed", () => {
    // Every listed place is the accent; the pin being aimed is the one thing on
    // the map that is not a place yet. The ring is drawn under the fill.
    const screen = render(
      <ContextForScreen>
        <PlaceLocator />
      </ContextForScreen>,
    )

    const [ring, fill] = screen.UNSAFE_getAllByType(Path)
    expect(ring.props.stroke).toBe("#FFFFFF")
    expect(ring.props.strokeWidth).toBe(4)
    expect(fill.props.fill).toBe("#3050C4")
  })
})
