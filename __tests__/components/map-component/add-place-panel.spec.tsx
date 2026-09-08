import React from "react"
import type { ReactTestInstance } from "react-test-renderer"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"

import { AddPlacePanel } from "@app/components/map-component/add-place-panel"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../../screens/helper"

// The category dropdown puts its list in a react-native-modal, which renders
// through a native host react-test-renderer never mounts. Without the stand-in
// the options are unreachable and every category tap below would be pressing
// nothing.
jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

const LOCATION = { latitude: 13.496743, longitude: -89.439462 }

const onSubmit = jest.fn<Promise<string | null>, [unknown]>()
const onClose = jest.fn()

type SheetProps = React.ComponentProps<typeof AddPlacePanel>

const sheet = (props: Partial<SheetProps> = {}) => (
  <ContextForScreen>
    <AddPlacePanel location={LOCATION} onSubmit={onSubmit} onClose={onClose} {...props} />
  </ContextForScreen>
)

const renderSheet = (props: Partial<SheetProps> = {}) => render(sheet(props))

type Queries = Pick<ReturnType<typeof renderSheet>, "getByTestId" | "getByText">

// One tap: every category is a chip on the form, so there is no list to open
// first.
const chooseCategory = ({ getByTestId }: Queries, category: string) => {
  fireEvent.press(getByTestId(`place-category-${category}`))
}

/** Which chip is answering the question, read the way a screen reader reads it. */
const isSelected = (chip: ReactTestInstance) =>
  Boolean(chip.props.accessibilityState?.selected)

const fillInForm = (queries: Queries) => {
  fireEvent.changeText(queries.getByTestId("place-name-input"), "Hope House")
  chooseCategory(queries, "cafes")
}

beforeEach(() => {
  jest.clearAllMocks()
  onSubmit.mockResolvedValue(null)
  loadLocale("en")
})

describe("AddPlacePanel", () => {
  it("shows where the pin is pointing", async () => {
    // The form is the only place the coordinates are readable, so a pin left in
    // the wrong street can still be caught before it is submitted.
    const { getByText } = renderSheet()

    await waitFor(() => expect(getByText("13.496743, -89.439462")).toBeTruthy())
  })

  it("follows the map, since the map is on screen and being panned", async () => {
    // The pin is aimed while this is open, so a row still naming where the map
    // was when the form opened would be describing a different place than the
    // one about to be submitted.
    const { getByText, rerender } = renderSheet()

    await waitFor(() => expect(getByText("13.496743, -89.439462")).toBeTruthy())

    rerender(sheet({ location: { latitude: 13.5, longitude: -89.44 } }))

    await waitFor(() => expect(getByText("13.500000, -89.440000")).toBeTruthy())
  })

  it("submits where the pin is by then, not where it was when the form opened", async () => {
    const { getByTestId, getByText, rerender } = renderSheet()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm({ getByTestId, getByText })
    rerender(sheet({ location: { latitude: 13.5, longitude: -89.44 } }))
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Hope House",
        category: "cafes",
        latitude: 13.5,
        longitude: -89.44,
      }),
    )
  })

  it("will not submit a place with no name", async () => {
    const { getByTestId, getByText } = renderSheet()

    await waitFor(() => expect(getByTestId("submit-place")).toBeTruthy())
    chooseCategory({ getByTestId, getByText }, "cafes")
    fireEvent.press(getByTestId("submit-place"))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("will not submit a place with no category", async () => {
    const { getByTestId } = renderSheet()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fireEvent.changeText(getByTestId("place-name-input"), "Hope House")
    fireEvent.press(getByTestId("submit-place"))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("does not offer the catch-all category", () => {
    // "other" is a filter bucket for unrecognised icons, not a description of
    // a place — a submission under it would tell BTC Map nothing.
    const { getByTestId, queryByTestId } = renderSheet()

    // Anchored on a category that is offered: without it the absence below
    // would also pass on a form that drew no chips at all.
    expect(getByTestId("place-category-cafes")).toBeTruthy()
    expect(queryByTestId("place-category-other")).toBeNull()
  })

  it("says on the button that there is still something missing", async () => {
    // Disabled and translucent is the whole explanation, so it has to reach a
    // screen reader as well as an eye.
    const { getByTestId, getByText } = renderSheet()

    await waitFor(() =>
      expect(getByTestId("submit-place").props.accessibilityState).toMatchObject({
        disabled: true,
      }),
    )

    fillInForm({ getByTestId, getByText })

    await waitFor(() =>
      expect(getByTestId("submit-place").props.accessibilityState).toMatchObject({
        disabled: false,
      }),
    )
  })

  it("submits the place once it has a name, a category and a pin", async () => {
    const { getByTestId, getByText } = renderSheet()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm({ getByTestId, getByText })
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
    const { getByTestId, getByText } = renderSheet()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm({ getByTestId, getByText })
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

  it("holds the row on the place it is sending, not on the map it cannot reach", async () => {
    // The request carries the pin as it stood when submit was tapped, and the
    // map is still pannable underneath. A row that kept following it would name
    // a place the request is not going to, and the success would announce a
    // place that is not where the row says it is.
    let resolveSend: ((reason: string | null) => void) | undefined
    onSubmit.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          resolveSend = resolve
        }),
    )
    const { getByTestId, getByText, rerender } = renderSheet()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm({ getByTestId, getByText })
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    rerender(sheet({ location: { latitude: 13.5, longitude: -89.44 } }))

    expect(getByText("13.496743, -89.439462")).toBeTruthy()

    // Only for as long as the send is. Once the place has been turned down the
    // pin is the first thing worth correcting, so the row goes back to the map.
    await act(async () => {
      resolveSend?.("Too many places sent today.")
    })

    await waitFor(() => expect(getByText("13.500000, -89.440000")).toBeTruthy())
  })

  it("says on the form itself why the place did not go", async () => {
    // Beside the button that would retry it, and beside everything that was
    // typed — a toast would put the reason at the other end of the screen from
    // both, and take it away again before the retry.
    onSubmit.mockResolvedValue("Too many places sent today. Try again tomorrow.")
    const { getByTestId, getByText } = renderSheet()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm({ getByTestId, getByText })
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
    const { getByTestId, getByText, queryByTestId } = renderSheet()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm({ getByTestId, getByText })
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() => expect(getByTestId("place-submission-error")).toBeTruthy())

    onSubmit.mockResolvedValue(null)
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() => expect(queryByTestId("place-submission-error")).toBeNull())
  })

  it("leaves the failure up when the map is merely panned", async () => {
    // Moving the pin used to be a deliberate trip back to the map, and it took
    // the failure off with it. The map is now under the form at all times, so
    // the same rule would let an idle nudge wipe a message before it has been
    // read. It goes on the next send instead.
    onSubmit.mockResolvedValue("Too many places sent today.")
    const { getByTestId, getByText, rerender } = renderSheet()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm({ getByTestId, getByText })
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() => expect(getByTestId("place-submission-error")).toBeTruthy())

    rerender(sheet({ location: { latitude: 13.5, longitude: -89.44 } }))

    expect(getByTestId("place-submission-error")).toBeTruthy()
  })

  it("takes the last failure off when the place itself is edited", async () => {
    // Same reason as the pin: the failure described the place as it stood, so
    // once the name or the category changes it is accusing a place that no
    // longer exists.
    onSubmit.mockResolvedValue("Too many places sent today.")
    const { getByTestId, getByText, queryByTestId } = renderSheet()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm({ getByTestId, getByText })
    fireEvent.press(getByTestId("submit-place"))

    await waitFor(() => expect(getByTestId("place-submission-error")).toBeTruthy())

    fireEvent.changeText(getByTestId("place-name-input"), "Hope House Café")
    await waitFor(() => expect(queryByTestId("place-submission-error")).toBeNull())

    fireEvent.press(getByTestId("submit-place"))
    await waitFor(() => expect(getByTestId("place-submission-error")).toBeTruthy())

    chooseCategory({ getByTestId, getByText }, "bars")
    await waitFor(() => expect(queryByTestId("place-submission-error")).toBeNull())
  })

  it("lets a mis-tapped category be swapped for another", async () => {
    // Every chip stays on screen, so the answer being given is which one reads
    // as selected — and only one of them may.
    const { getByTestId } = renderSheet()

    await waitFor(() => expect(getByTestId("place-category-cafes")).toBeTruthy())
    fireEvent.press(getByTestId("place-category-cafes"))

    await waitFor(() =>
      expect(isSelected(getByTestId("place-category-cafes"))).toBe(true),
    )

    fireEvent.press(getByTestId("place-category-bars"))

    await waitFor(() => expect(isSelected(getByTestId("place-category-bars"))).toBe(true))
    expect(isSelected(getByTestId("place-category-cafes"))).toBe(false)
  })

  it("takes a category back off when its own chip is tapped again", async () => {
    // There is no empty row to pick in a set of chips the way there is in a
    // list, so the chip that is on has to be the way back off it.
    const { getByTestId } = renderSheet()

    fireEvent.changeText(getByTestId("place-name-input"), "Hope House")
    fireEvent.press(getByTestId("place-category-cafes"))

    await waitFor(() => expect(getByTestId("submit-place")).not.toBeDisabled())

    fireEvent.press(getByTestId("place-category-cafes"))

    expect(isSelected(getByTestId("place-category-cafes"))).toBe(false)
    // And with no category there is nothing to send again.
    await waitFor(() => expect(getByTestId("submit-place")).toBeDisabled())
  })

  it("keeps what has been typed while the pin is moved", async () => {
    // Panning is a correction, not a restart: retyping the name to fix the pin
    // would make moving it not worth doing.
    const { getByTestId, getByText, rerender } = renderSheet()

    await waitFor(() => expect(getByTestId("place-name-input")).toBeTruthy())
    fillInForm({ getByTestId, getByText })

    rerender(sheet({ location: { latitude: 13.5, longitude: -89.44 } }))

    await waitFor(() =>
      expect(getByTestId("place-name-input").props.value).toBe("Hope House"),
    )
    expect(getByText("Cafés")).toBeTruthy()
    expect(getByText("13.500000, -89.440000")).toBeTruthy()
  })
})
