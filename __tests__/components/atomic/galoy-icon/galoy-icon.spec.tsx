import React from "react"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import theme from "@app/rne-theme/theme"

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

describe("GaloyIcon", () => {
  it("returns null for an unmapped icon name instead of rendering undefined", () => {
    const { toJSON } = renderWithTheme(
      <GaloyIcon name={"warning-with_background" as IconNamesType} size={24} />,
    )

    expect(toJSON()).toBeNull()
  })

  describe("phosphor icons", () => {
    it("renders with a numeric size", () => {
      expect(renderWithTheme(<GaloyIcon name="info" size={24} />).toJSON()).not.toBeNull()
    })

    it("renders inside a background container", () => {
      expect(
        renderWithTheme(
          <GaloyIcon name="info" size={24} backgroundColor="red" />,
        ).toJSON(),
      ).not.toBeNull()
    })

    it("renders with a custom color and opacity", () => {
      expect(
        renderWithTheme(
          <GaloyIcon name="info" size={24} color="blue" opacity={0.5} />,
        ).toJSON(),
      ).not.toBeNull()
    })

    it("renders with a size variant", () => {
      expect(
        renderWithTheme(<GaloyIcon name="info" sizeVariant="lg" />).toJSON(),
      ).not.toBeNull()
    })
  })

  describe("custom SVG icons", () => {
    it("renders with a numeric size", () => {
      expect(
        renderWithTheme(<GaloyIcon name="warning-with-background" size={24} />).toJSON(),
      ).not.toBeNull()
    })

    it("renders inside a background container", () => {
      expect(
        renderWithTheme(
          <GaloyIcon name="warning-with-background" size={24} backgroundColor="red" />,
        ).toJSON(),
      ).not.toBeNull()
    })

    it("renders with explicit width and height", () => {
      expect(
        renderWithTheme(
          <GaloyIcon name="warning-with-background" width={24} height={24} />,
        ).toJSON(),
      ).not.toBeNull()
    })

    it("renders the limits icon", () => {
      expect(
        renderWithTheme(<GaloyIcon name="limits" size={24} />).toJSON(),
      ).not.toBeNull()
    })

    it("renders the spinner icon", () => {
      expect(
        renderWithTheme(<GaloyIcon name="spinner" size={24} />).toJSON(),
      ).not.toBeNull()
    })

    it("renders the magic-wand icon", () => {
      expect(
        renderWithTheme(<GaloyIcon name="magic-wand" size={24} />).toJSON(),
      ).not.toBeNull()
    })

    it("renders the sunglasses icon", () => {
      expect(
        renderWithTheme(<GaloyIcon name="sunglasses" size={24} />).toJSON(),
      ).not.toBeNull()
    })
  })

  describe("prop fallbacks", () => {
    // The size and colour props overlap deliberately; each fallback below is a
    // combination real call sites use.
    it("falls back to the theme colour when none is given", () => {
      const { getByTestId } = renderWithTheme(<GaloyIcon name="info" size={24} />)

      expect(getByTestId("icon-info").props.color).toBe(theme.lightColors?.black)
    })

    it("takes its size from width and height when size is absent", () => {
      expect(
        renderWithTheme(<GaloyIcon name="info" width={30} height={18} />).toJSON(),
      ).not.toBeNull()
    })

    it("accepts a non-default phosphor weight", () => {
      expect(
        renderWithTheme(<GaloyIcon name="info" size={24} weight="bold" />).toJSON(),
      ).not.toBeNull()
    })

    it("gives a custom svg its width and height separately", () => {
      const { getByTestId } = renderWithTheme(
        <GaloyIcon name="emergency-kit" width={30} height={18} />,
      )

      expect(getByTestId("icon-emergency-kit").props.width).toBe(30)
      expect(getByTestId("icon-emergency-kit").props.height).toBe(18)
    })

    it("renders a custom svg inside a background container with a fixed container size", () => {
      expect(
        renderWithTheme(
          <GaloyIcon
            name="emergency-kit"
            size={24}
            backgroundColor="red"
            containerSize={60}
            opacity={0.4}
          />,
        ).toJSON(),
      ).not.toBeNull()
    })

    it("renders a phosphor icon inside a background container with a fixed container size", () => {
      expect(
        renderWithTheme(
          <GaloyIcon
            name="info"
            size={24}
            backgroundColor="red"
            containerSize={60}
            opacity={0.4}
          />,
        ).toJSON(),
      ).not.toBeNull()
    })
  })
})
