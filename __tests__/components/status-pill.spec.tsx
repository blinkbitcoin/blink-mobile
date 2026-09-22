import React from "react"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { StatusPill, type StatusPillVariant } from "@app/components/status-pill"

const renderPill = (props: React.ComponentProps<typeof StatusPill>) =>
  render(
    <ThemeProvider theme={theme}>
      <StatusPill {...props} />
    </ThemeProvider>,
  )

describe("StatusPill", () => {
  it("renders the provided label", () => {
    const { getByText } = renderPill({ label: "Out of date", status: "warning" })

    expect(getByText("Out of date")).toBeTruthy()
  })

  const VARIANTS: StatusPillVariant[] = ["warning", "error", "success", "primary"]

  VARIANTS.forEach((variant) => {
    it(`renders without crashing for variant ${variant}`, () => {
      const { getByText } = renderPill({ label: "TAG", status: variant })

      expect(getByText("TAG")).toBeTruthy()
    })
  })

  it("exposes the testID when provided", () => {
    const { getByTestId } = renderPill({
      label: "Out of date",
      status: "warning",
      testID: "recovery-backup-chip",
    })

    expect(getByTestId("recovery-backup-chip")).toBeTruthy()
  })

  it("renders without a testID", () => {
    const { getByText } = renderPill({ label: "Backed up", status: "success" })

    expect(getByText("Backed up")).toBeTruthy()
  })

  /** The pill shares a width-capped row with the setting's title, so a label
   *  has to truncate rather than push the row wider or wrap onto a second
   *  line. Asserted on the props rather than on measured layout, which jest
   *  does not compute. */
  it("truncates its label to a single line instead of wrapping", () => {
    const { getByText } = renderPill({ label: "Not set up", status: "primary" })

    const label = getByText("Not set up")
    expect(label.props.numberOfLines).toBe(1)
    expect(label.props.ellipsizeMode).toBe("tail")
  })

  it("caps font scaling so Dynamic Type cannot outgrow the row", () => {
    const { getByText } = renderPill({ label: "Backed up", status: "success" })

    expect(getByText("Backed up").props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.5)
  })
})
