import * as React from "react"
import { render, screen } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import theme from "@app/rne-theme/theme"
import { MAX_FONT_SIZE_MULTIPLIER } from "@app/rne-theme/text-scaling"

const renderButton = (text?: string) =>
  render(
    <ThemeProvider theme={theme}>
      <GaloyIconButton name="receive" size="large" text={text} />
    </ThemeProvider>,
  )

describe("GaloyIconButton", () => {
  it("shows the label it was given", () => {
    renderButton("Receive")

    expect(screen.getByText("Receive")).toBeTruthy()
  })

  /**
   * These labels name the home screen's primary actions, and they sit in a column barely
   * wider than the word. Uncapped, the OS text setting truncates them to "Re…", "Se…" and
   * "Sc…", which is the failure #4129 opens with: the actions stop being identifiable.
   * The label inherits the ceiling from the theme rather than declaring its own.
   */
  it("caps how far the OS text size carries its label", () => {
    renderButton("Receive")

    expect(screen.getByText("Receive").props.maxFontSizeMultiplier).toBe(
      MAX_FONT_SIZE_MULTIPLIER,
    )
  })

  it("renders the icon alone when there is no label", () => {
    renderButton()

    expect(screen.queryByText("Receive")).toBeNull()
  })
})
