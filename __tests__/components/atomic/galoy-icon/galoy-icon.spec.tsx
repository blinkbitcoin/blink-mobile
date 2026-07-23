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
  })
})
