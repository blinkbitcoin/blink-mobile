import React from "react"
import { View } from "react-native"
import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { PLACE_CATEGORIES, PlaceCategory } from "@app/btcmap"
import { CategoryFilterSheet } from "@app/components/map-component/category-filter-sheet"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "../../screens/helper"

// The rows are `Switch`, whose animated style predates the explicit-dependency
// convention and throws without the Babel plugin. Same stand-in as switch.spec.
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View },
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedStyle: () => ({}),
  withTiming: (value: number) => value,
  interpolateColor: () => "transparent",
}))

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const renderSheet = (
  props: Partial<React.ComponentProps<typeof CategoryFilterSheet>> = {},
) =>
  render(
    <ContextForScreen>
      <CategoryFilterSheet
        isVisible
        selected={new Set<PlaceCategory>()}
        onChange={jest.fn()}
        onClose={jest.fn()}
        {...props}
      />
    </ContextForScreen>,
  )

beforeEach(() => {
  jest.clearAllMocks()
  loadLocale("en")
})

describe("CategoryFilterSheet", () => {
  it("offers every category, so nothing on the map is unfilterable", async () => {
    const { getByTestId } = renderSheet()

    await waitFor(() => expect(getByTestId("category-restaurants")).toBeTruthy())
    PLACE_CATEGORIES.forEach((category) => {
      expect(getByTestId(`category-${category}`)).toBeTruthy()
    })
  })

  it("switches a category on", async () => {
    const onChange = jest.fn()
    const { getByTestId } = renderSheet({ onChange })

    await waitFor(() => expect(getByTestId("category-groceries")).toBeTruthy())
    fireEvent(getByTestId("category-groceries"), "pressIn")

    expect(onChange).toHaveBeenCalledWith(new Set(["groceries"]))
  })

  it("switches one back off without disturbing the rest", async () => {
    const onChange = jest.fn()
    const { getByTestId } = renderSheet({
      selected: new Set<PlaceCategory>(["groceries", "bars"]),
      onChange,
    })

    await waitFor(() => expect(getByTestId("category-bars")).toBeTruthy())
    fireEvent(getByTestId("category-bars"), "pressIn")

    expect(onChange).toHaveBeenCalledWith(new Set(["groceries"]))
  })

  it("selects the lot in one press", async () => {
    const onChange = jest.fn()
    const { getByText } = renderSheet({ onChange })

    await waitFor(() => expect(getByText("Select all")).toBeTruthy())
    fireEvent.press(getByText("Select all"))

    expect(onChange).toHaveBeenCalledWith(new Set(PLACE_CATEGORIES))
  })

  it("turns into a way back to the whole map once everything is on", async () => {
    const onChange = jest.fn()
    const { getByText } = renderSheet({
      selected: new Set(PLACE_CATEGORIES),
      onChange,
    })

    await waitFor(() => expect(getByText("Clear all")).toBeTruthy())
    fireEvent.press(getByText("Clear all"))

    // Empty is "show everything", so this is the same map — arrived at without
    // fifteen presses.
    expect(onChange).toHaveBeenCalledWith(new Set())
  })
})
