import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { FeeTierSelector } from "@app/screens/send-bitcoin-screen/fee-tier-selector"

const buildOptions = () => [
  { id: "fast", label: "Fast", detail: "30 sat/vB" },
  { id: "medium", label: "Medium", detail: "20 sat/vB" },
  { id: "slow", label: "Slow", detail: "10 sat/vB" },
]

const renderSelector = (
  props: Partial<React.ComponentProps<typeof FeeTierSelector>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <FeeTierSelector
        title="Network fee"
        options={buildOptions()}
        selected="medium"
        onSelect={jest.fn()}
        {...props}
      />
    </ThemeProvider>,
  )

describe("FeeTierSelector", () => {
  it("renders the title", () => {
    const { getByText } = renderSelector()

    expect(getByText("Network fee")).toBeTruthy()
  })

  it("shows the label and detail of the currently selected option", () => {
    const { getByText } = renderSelector({ selected: "fast" })

    expect(getByText("Fast")).toBeTruthy()
    expect(getByText("30 sat/vB")).toBeTruthy()
  })

  it("opens the modal when the dropdown is pressed and lists every option", () => {
    const { getByTestId, getAllByText } = renderSelector()

    fireEvent.press(getByTestId("fee-tier-dropdown"))

    // Every option label is now visible in the modal list.
    expect(getAllByText("Fast").length).toBeGreaterThan(0)
    expect(getAllByText("Medium").length).toBeGreaterThan(0)
    expect(getAllByText("Slow").length).toBeGreaterThan(0)
  })

  it("calls onSelect with the chosen tier id when an option is tapped", () => {
    const onSelect = jest.fn()
    const { getByTestId } = renderSelector({ onSelect })

    fireEvent.press(getByTestId("fee-tier-dropdown"))
    fireEvent.press(getByTestId("fee-tier-slow"))

    expect(onSelect).toHaveBeenCalledWith("slow")
  })

  it("renders gracefully when the selected id is unknown", () => {
    // Pass a selected id that isn't in options to ensure no crash.
    const { getByTestId } = renderSelector({ selected: "nonexistent" as never })

    expect(getByTestId("fee-tier-dropdown")).toBeTruthy()
  })

  it("hides detail when an option's detail is empty", () => {
    const opts = [{ id: "only", label: "Only option", detail: "" }]
    const { queryAllByText } = render(
      <ThemeProvider theme={theme}>
        <FeeTierSelector
          title="Network fee"
          options={opts}
          selected="only"
          onSelect={jest.fn()}
        />
      </ThemeProvider>,
    )

    // No element rendering the detail because it's an empty string.
    expect(queryAllByText("")).toHaveLength(0)
  })
})
