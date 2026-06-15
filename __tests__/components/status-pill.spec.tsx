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
    const { getByText } = renderPill({ label: "STALE", status: "warning" })

    expect(getByText("STALE")).toBeTruthy()
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
      label: "STALE",
      status: "warning",
      testID: "balance-stale-pill",
    })

    expect(getByTestId("balance-stale-pill")).toBeTruthy()
  })

  it("hides itself from accessibility and ignores the testID when ghost", () => {
    const { queryByTestId } = renderPill({
      label: "STALE",
      status: "warning",
      ghost: true,
      testID: "should-not-appear",
    })

    expect(queryByTestId("should-not-appear")).toBeNull()
  })
})
