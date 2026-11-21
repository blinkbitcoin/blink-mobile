import { describe, expect, it } from "@jest/globals"
import React from "react"
import { StyleSheet } from "react-native"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import theme from "@app/rne-theme/theme"

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

const callerMargins = StyleSheet.create({ close: { marginRight: 12, marginVertical: 2 } })

const buttonStyle = (ui: React.ReactElement, testID = "menu") =>
  StyleSheet.flatten(renderWithTheme(ui).getByTestId(testID).props.style)

const MARGINS = [
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
] as const

/* A medium icon (20dp) sits in a 32dp circle. In the header that box is the whole touch
 * target: Android drops a touch outside the parent's bounds before `hitSlop` sees it, and
 * the native header item sizes itself to the margin box, so the growth must stay in it. */
describe("GaloyIconButton touchPadding", () => {
  it("grows the box by the padding on every side", () => {
    const style = buttonStyle(
      <GaloyIconButton name="menu" size="medium" iconOnly touchPadding={8} />,
    )

    expect(style).toMatchObject({
      width: 48,
      height: 48,
      paddingTop: 8,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8,
    })
  })

  it("grows only the sides it is given", () => {
    const style = buttonStyle(
      <GaloyIconButton
        name="menu"
        size="medium"
        iconOnly
        touchPadding={{ top: 8, right: 8, left: 8 }}
      />,
    )

    expect(style).toMatchObject({
      width: 48,
      height: 40,
      paddingTop: 8,
      paddingBottom: 0,
    })
  })

  it("never takes the growth back with negative margins", () => {
    const style = buttonStyle(
      <GaloyIconButton name="menu" size="medium" iconOnly touchPadding={8} />,
    )

    MARGINS.forEach((side) => expect(style[side] ?? 0).toBeGreaterThanOrEqual(0))
  })

  it("keeps the caller's own margins as they are", () => {
    const style = buttonStyle(
      <GaloyIconButton
        name="close"
        size="medium"
        touchPadding={8}
        style={callerMargins.close}
      />,
      "close",
    )

    expect(style).toMatchObject({ width: 48, marginRight: 12, marginVertical: 2 })
  })

  /** Past the parent, `hitSlop` is drawn by the touchables inspector but never gets a
   *  touch, so with a real box it would only overstate the target. */
  it("drops hitSlop once the touch box is real", () => {
    const { getByTestId } = renderWithTheme(
      <GaloyIconButton name="menu" size="medium" iconOnly touchPadding={8} />,
    )

    expect(getByTestId("menu").props.hitSlop).toBe(0)
  })

  it("keeps the 32dp box when no touch padding is asked for", () => {
    const style = buttonStyle(<GaloyIconButton name="menu" size="medium" iconOnly />)

    expect(style).toMatchObject({ width: 32, height: 32 })
    expect(style.paddingTop).toBeUndefined()
  })

  it("ignores the touch padding on a button with text, which lays out by its label", () => {
    const style = buttonStyle(
      <GaloyIconButton name="menu" size="medium" text="Menu" touchPadding={8} />,
      "Menu",
    )

    expect(style.width).toBeUndefined()
  })
})

/* Figma's `galoy-icon-button` sizes: circle / icon, in dp. */
describe("GaloyIconButton sizes", () => {
  it.each([
    ["small", 20, 16],
    ["medium", 32, 20],
    ["large", 44, 32],
  ] as const)("draws %s as a %ddp circle with a %ddp icon", (size, circle, icon) => {
    const { getByTestId } = renderWithTheme(<GaloyIconButton name="close" size={size} />)

    expect(StyleSheet.flatten(getByTestId("close").props.style)).toMatchObject({
      width: circle,
      height: circle,
    })
    expect(getByTestId("icon-close").props).toMatchObject({ width: icon, height: icon })
  })
})
