import * as React from "react"
import { render, screen } from "@testing-library/react-native"

import { Text, ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { MAX_FONT_SIZE_MULTIPLIER } from "@app/rne-theme/text-scaling"

/**
 * The app has no text-size control of its own, so every screen follows the OS setting
 * directly. The ceiling that keeps that from breaking layouts lives on the theme, which is
 * what makes it a policy rather than another per-screen patch: these assert that a screen
 * inherits it without asking, and that a component may still overrule it.
 */
const renderThemed = (children: React.ReactNode) =>
  render(<ThemeProvider theme={theme}>{children}</ThemeProvider>)

describe("text scaling ceiling", () => {
  it("caps how far the OS text size carries any themed text", () => {
    renderThemed(<Text testID="subject">Balances</Text>)

    expect(screen.getByTestId("subject").props.maxFontSizeMultiplier).toBe(
      MAX_FONT_SIZE_MULTIPLIER,
    )
  })

  /** Every preset, since a screen picks one by role and none of them is exempt. */
  const presets = ["h1", "h2", "p1", "p2", "p3", "p4"] as const
  presets.forEach((type) => {
    it(`caps the ${type} preset the same`, () => {
      renderThemed(
        <Text testID="subject" type={type}>
          Balances
        </Text>,
      )

      expect(screen.getByTestId("subject").props.maxFontSizeMultiplier).toBe(
        MAX_FONT_SIZE_MULTIPLIER,
      )
    })
  })

  /**
   * The ceiling is a default, not a rule the app cannot bend: a fixed-height slot may need
   * a stricter one, and a screen built to reflow may earn a looser one. The theme's props
   * are merged under the component's, so the component wins.
   */
  it("yields to a component that sets its own ceiling", () => {
    renderThemed(
      <Text testID="subject" maxFontSizeMultiplier={1}>
        Balances
      </Text>,
    )

    expect(screen.getByTestId("subject").props.maxFontSizeMultiplier).toBe(1)
  })

  /** Text still follows the OS below the ceiling; this caps growth, never scaling. */
  it("leaves the text free to scale up to the ceiling", () => {
    expect(MAX_FONT_SIZE_MULTIPLIER).toBeGreaterThan(1)
  })
})
