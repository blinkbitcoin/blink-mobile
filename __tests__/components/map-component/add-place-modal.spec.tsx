import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { AddPlaceModal } from "@app/components/map-component/add-place-modal"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../../screens/helper"

const LOCATION = { latitude: 13.496743, longitude: -89.439462 }

const onSubmit = jest.fn()
const onChangeLocation = jest.fn()
const onClose = jest.fn()

const renderModal = (props: Partial<React.ComponentProps<typeof AddPlaceModal>> = {}) =>
  render(
    <ContextForScreen>
      <AddPlaceModal
        isVisible={true}
        location={LOCATION}
        onSubmit={onSubmit}
        onChangeLocation={onChangeLocation}
        onClose={onClose}
        {...props}
      />
    </ContextForScreen>,
  )

beforeEach(() => {
  jest.clearAllMocks()
  loadLocale("en")
})

describe("AddPlaceModal", () => {
  it("shows where the pin was dropped", async () => {
    // The form is the only place the coordinates are readable, so a pin put
    // down in the wrong street can still be caught before it is submitted.
    const { getByText } = renderModal()

    await waitFor(() => expect(getByText("13.496743, -89.439462")).toBeTruthy())
  })

  it("will not submit a place with no name", async () => {
    const { getByTestId } = renderModal()

    await waitFor(() => expect(getByTestId("submit-place")).toBeTruthy())
    fireEvent.press(getByTestId("place-category-cafes"))
    fireEvent.press(getByTestId("submit-place"))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("will not submit a place with no category", async () => {
    const { getByTestId } = renderModal()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fireEvent.changeText(getByTestId("place-name-input"), "Hope House")
    fireEvent.press(getByTestId("submit-place"))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("says on the button that there is still something missing", async () => {
    // Disabled and translucent is the whole explanation, so it has to reach a
    // screen reader as well as an eye.
    const { getByTestId } = renderModal()

    await waitFor(() =>
      expect(getByTestId("submit-place").props.accessibilityState).toMatchObject({
        disabled: true,
      }),
    )

    fireEvent.changeText(getByTestId("place-name-input"), "Hope House")
    fireEvent.press(getByTestId("place-category-cafes"))

    await waitFor(() =>
      expect(getByTestId("submit-place").props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    )
  })

  it("submits the place once it has a name, a category and a pin", async () => {
    const { getByTestId } = renderModal()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fireEvent.changeText(getByTestId("place-name-input"), "Hope House")
    fireEvent.changeText(getByTestId("place-address-input"), "Calle El Zonte")
    fireEvent.press(getByTestId("place-category-cafes"))
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Hope House",
        address: "Calle El Zonte",
        category: "cafes",
        latitude: LOCATION.latitude,
        longitude: LOCATION.longitude,
      }),
    )
  })

  it("lets a category be taken back off", async () => {
    // The chips are one choice rather than a set, so the only way out of a
    // mis-tap is tapping the same chip again.
    const { getByTestId } = renderModal()

    await waitFor(() => expect(getByTestId("place-category-cafes")).toBeTruthy())
    fireEvent.press(getByTestId("place-category-cafes"))

    await waitFor(() =>
      expect(getByTestId("place-category-cafes").props.accessibilityState).toMatchObject({
        selected: true,
      }),
    )

    fireEvent.press(getByTestId("place-category-cafes"))

    await waitFor(() =>
      expect(getByTestId("place-category-cafes").props.accessibilityState).toMatchObject({
        selected: false,
      }),
    )
  })

  it("keeps what has been typed while the pin is moved", async () => {
    // Going back to the map is a correction, not a restart: retyping the name
    // to fix the pin would make moving it not worth doing.
    const { getByTestId, getByText, rerender } = renderModal()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fireEvent.changeText(getByTestId("place-name-input"), "Hope House")
    fireEvent.press(getByTestId("change-place-location"))

    expect(onChangeLocation).toHaveBeenCalled()

    rerender(
      <ContextForScreen>
        <AddPlaceModal
          isVisible={false}
          location={LOCATION}
          onSubmit={onSubmit}
          onChangeLocation={onChangeLocation}
          onClose={onClose}
        />
      </ContextForScreen>,
    )
    rerender(
      <ContextForScreen>
        <AddPlaceModal
          isVisible={true}
          location={{ latitude: 13.5, longitude: -89.44 }}
          onSubmit={onSubmit}
          onChangeLocation={onChangeLocation}
          onClose={onClose}
        />
      </ContextForScreen>,
    )

    await waitFor(() =>
      expect(getByTestId("place-name-input").props.value).toBe("Hope House"),
    )
    expect(getByText("13.500000, -89.440000")).toBeTruthy()
  })
})
