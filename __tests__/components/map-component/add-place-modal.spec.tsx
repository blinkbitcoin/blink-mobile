import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { AddPlaceModal } from "@app/components/map-component/add-place-modal"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../../screens/helper"

const LOCATION = { latitude: 13.496743, longitude: -89.439462 }

const onSubmit = jest.fn<Promise<string | null>, [unknown]>()
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

const fillInForm = (getByTestId: (id: string) => unknown) => {
  fireEvent.changeText(getByTestId("place-name-input") as never, "Hope House")
  fireEvent.press(getByTestId("place-category-cafes") as never)
}

beforeEach(() => {
  jest.clearAllMocks()
  onSubmit.mockResolvedValue(null)
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

  it("does not offer the catch-all category", () => {
    // "other" is a filter bucket for unrecognised icons, not a description of
    // a place — a submission under it would tell BTC Map nothing.
    const { queryByTestId } = renderModal()

    expect(queryByTestId("place-category-other")).toBeNull()
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

    fillInForm(getByTestId)

    await waitFor(() =>
      expect(getByTestId("submit-place").props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    )
  })

  it("submits the place once it has a name, a category and a pin", async () => {
    const { getByTestId } = renderModal()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm(getByTestId)
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Hope House",
        category: "cafes",
        latitude: LOCATION.latitude,
        longitude: LOCATION.longitude,
      }),
    )
  })

  it("sends once no matter how often submit is tapped while a send is in flight", async () => {
    // The send is a network round trip; without the guard each tap would fire
    // its own mutation and stack its own toast.
    let resolveSend: (() => void) | undefined
    onSubmit.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          resolveSend = () => resolve(null)
        }),
    )
    const { getByTestId } = renderModal()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm(getByTestId)
    fireEvent.press(getByTestId("submit-place"))
    fireEvent.press(getByTestId("submit-place"))
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))

    resolveSend?.()
    await waitFor(() =>
      expect(getByTestId("submit-place").props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    )
  })

  it("will not put the pin back on the move while the send is in flight", async () => {
    // The request carries the pin as it stood when submit was tapped, so there
    // is nothing left for a correction to reach: the place would land at the
    // old spot while the map showed the new one, and the success would announce
    // it over a pin that is not where it went.
    let resolveSend: (() => void) | undefined
    onSubmit.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          resolveSend = () => resolve(null)
        }),
    )
    const { getByTestId } = renderModal()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm(getByTestId)
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() =>
      expect(getByTestId("change-place-location").props.accessibilityState).toMatchObject(
        { disabled: true },
      ),
    )
    fireEvent.press(getByTestId("change-place-location"))
    expect(onChangeLocation).not.toHaveBeenCalled()

    // Only for as long as the send is: the pin is the first thing worth
    // correcting once the place has been turned down.
    resolveSend?.()
    await waitFor(() =>
      expect(getByTestId("change-place-location").props.accessibilityState).toMatchObject(
        { disabled: false },
      ),
    )
    fireEvent.press(getByTestId("change-place-location"))
    expect(onChangeLocation).toHaveBeenCalled()
  })

  it("says on the form itself why the place did not go", async () => {
    // This is a native modal over the whole app and the app's toast is mounted
    // outside it, so a failure reported that way is drawn behind this window:
    // the form would sit there looking as though the tap had done nothing.
    onSubmit.mockResolvedValue("Too many places sent today. Try again tomorrow.")
    const { getByTestId, getByText } = renderModal()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm(getByTestId)
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() =>
      expect(getByText("Too many places sent today. Try again tomorrow.")).toBeTruthy(),
    )
    // And the form is still there to retry or correct.
    expect(getByTestId("submit-place")).toBeTruthy()
  })

  it("takes the last failure off the form when the place goes", async () => {
    // Leaving it up would have a place that has just been sent still reading as
    // one that could not be.
    onSubmit.mockResolvedValueOnce("Too many places sent today.")
    const { getByTestId, queryByTestId } = renderModal()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm(getByTestId)
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() => expect(getByTestId("place-submission-error")).toBeTruthy())

    onSubmit.mockResolvedValue(null)
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() => expect(queryByTestId("place-submission-error")).toBeNull())
  })

  it("takes the last failure off when the pin goes back on the move", async () => {
    // It was a failure about the place as it stood, pin included, so it stops
    // being true as soon as the pin is being moved.
    onSubmit.mockResolvedValue("Too many places sent today.")
    const { getByTestId, queryByTestId } = renderModal()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm(getByTestId)
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() => expect(getByTestId("place-submission-error")).toBeTruthy())

    fireEvent.press(getByTestId("change-place-location"))

    expect(onChangeLocation).toHaveBeenCalled()
    await waitFor(() => expect(queryByTestId("place-submission-error")).toBeNull())
  })

  it("takes the last failure off when the place itself is edited", async () => {
    // Same reason as the pin: the failure described the place as it stood, so
    // once the name or the category changes it is accusing a place that no
    // longer exists.
    onSubmit.mockResolvedValue("Too many places sent today.")
    const { getByTestId, queryByTestId } = renderModal()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm(getByTestId)
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() => expect(getByTestId("place-submission-error")).toBeTruthy())

    fireEvent.changeText(getByTestId("place-name-input"), "Hope House Café")
    await waitFor(() => expect(queryByTestId("place-submission-error")).toBeNull())

    fireEvent.press(getByTestId("submit-place"))
    await waitFor(() => expect(getByTestId("place-submission-error")).toBeTruthy())

    fireEvent.press(getByTestId("place-category-bars"))
    await waitFor(() => expect(queryByTestId("place-submission-error")).toBeNull())
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
