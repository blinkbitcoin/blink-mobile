import React from "react"
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native"
import { render, screen } from "@testing-library/react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { ContextForScreen } from "../../screens/helper"

const renderButton = (props: { disabled?: boolean; loading?: boolean } = {}) =>
  render(
    <ContextForScreen>
      <GaloyPrimaryButton title="Continue" onPress={() => {}} {...props} />
    </ContextForScreen>,
  )

/**
 * The button's own painted surface: the innermost view carrying a background,
 * which is where buttonStyle and disabledStyle end up merged together.
 */
const getButtonSurfaceStyle = () => {
  const surface = screen.UNSAFE_getAllByType(View).find((node) => {
    const style = StyleSheet.flatten(node.props.style) as ViewStyle | undefined
    return Boolean(style?.backgroundColor)
  })
  if (!surface) {
    throw new Error("No painted button surface found")
  }
  return StyleSheet.flatten(surface.props.style) as ViewStyle
}

const getTitleColor = () =>
  (StyleSheet.flatten(screen.getByText("Continue").props.style) as TextStyle).color

const getSpinnerColor = () =>
  screen.UNSAFE_getByType(ActivityIndicator).props.color as string

/** WCAG relative luminance of an `#rrggbb` colour. */
const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/** WCAG contrast ratio between two `#rrggbb` colours, 1 (identical) to 21. */
const contrastRatio = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

// The disabled title is 20pt/600, which WCAG counts as large text: 3:1, not 4.5:1.
const LARGE_TEXT_AA = 3

describe("GaloyPrimaryButton", () => {
  describe("contrast helper", () => {
    it("scores identical colours as 1 and black against white as 21", () => {
      expect(contrastRatio("#7f7f7f", "#7f7f7f")).toBeCloseTo(1, 5)
      expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1)
    })
  })

  describe("when disabled", () => {
    it("paints an opaque surface", () => {
      renderButton({ disabled: true })
      const style = getButtonSurfaceStyle()

      // A translucent disabled button composites whatever sits behind it, so
      // content could read straight through the CTA. It has to own its pixels.
      expect(style.backgroundColor).toBeTruthy()
      expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
      expect(style.opacity === undefined || style.opacity === 1).toBe(true)
    })

    it("keeps a distinct surface from the enabled state", () => {
      renderButton()
      const enabledBackground = getButtonSurfaceStyle().backgroundColor
      screen.unmount()

      renderButton({ disabled: true })
      const disabledBackground = getButtonSurfaceStyle().backgroundColor

      expect(disabledBackground).not.toBe(enabledBackground)
    })

    it("outlines the surface so it survives a low-contrast background", () => {
      renderButton({ disabled: true })
      const style = getButtonSurfaceStyle()

      // Modals paint grey5 and the disabled fill is grey4 — about 1.13:1 apart,
      // so without an edge the CTA reads as absent rather than as disabled.
      expect(style.borderWidth).toBeGreaterThan(0)
      expect(style.borderColor).toBeTruthy()
      expect(style.borderColor).not.toBe(style.backgroundColor)
    })

    it("keeps the title readable against the disabled surface", () => {
      renderButton({ disabled: true })

      expect(
        contrastRatio(
          getTitleColor() as string,
          getButtonSurfaceStyle().backgroundColor as string,
        ),
      ).toBeGreaterThanOrEqual(LARGE_TEXT_AA)
    })

    it("keeps the spinner visible against the disabled surface", () => {
      // Screens that gate on an in-flight call pass disabled and loading at the
      // same time (the explainer CTA does, for the whole provisioning wait). The
      // library's hardcoded white spinner disappears on the grey fill.
      renderButton({ disabled: true, loading: true })

      expect(
        contrastRatio(
          getSpinnerColor(),
          getButtonSurfaceStyle().backgroundColor as string,
        ),
      ).toBeGreaterThanOrEqual(LARGE_TEXT_AA)
    })
  })

  describe("when enabled", () => {
    it("keeps the spinner visible against the primary surface", () => {
      renderButton({ loading: true })

      expect(
        contrastRatio(
          getSpinnerColor(),
          getButtonSurfaceStyle().backgroundColor as string,
        ),
      ).toBeGreaterThanOrEqual(LARGE_TEXT_AA)
    })

    it("draws the spinner in the same colour as the title", () => {
      // The title is replaced by the spinner while loading, so read it from the
      // idle render. Dark theme inverts `white`, and the library's literal
      // 'white' spinner would drift from the title it stands in for.
      renderButton()
      const titleColor = getTitleColor()
      screen.unmount()

      renderButton({ loading: true })

      expect(getSpinnerColor()).toBe(titleColor)
    })
  })

  it("lets callers override the spinner colour", () => {
    render(
      <ContextForScreen>
        <GaloyPrimaryButton
          title="Continue"
          loading
          loadingProps={{ color: "#123456" }}
          onPress={() => {}}
        />
      </ContextForScreen>,
    )

    expect(getSpinnerColor()).toBe("#123456")
  })

  it("takes its testID from a string title, and skips it for a rendered one", () => {
    renderButton()
    expect(screen.getByTestId("Continue")).toBeTruthy()
    screen.unmount()

    // A node title has no string to name the button by, so the automatic
    // testProps are skipped rather than stringified into a useless id.
    render(
      <ContextForScreen>
        <GaloyPrimaryButton title={<Text>Continue</Text>} onPress={() => {}} />
      </ContextForScreen>,
    )

    expect(screen.getByText("Continue")).toBeTruthy()
    expect(screen.queryByTestId("Continue")).toBeNull()
  })
})
