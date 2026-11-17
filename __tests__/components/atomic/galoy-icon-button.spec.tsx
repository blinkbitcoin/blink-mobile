import React from "react"
import { StyleSheet } from "react-native"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import theme from "@app/rne-theme/theme"

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

const callerMargins = StyleSheet.create({ close: { marginRight: 13, marginVertical: 2 } })

const buttonStyle = (ui: React.ReactElement, testID = "menu") =>
  StyleSheet.flatten(renderWithTheme(ui).getByTestId(testID).props.style)

const MARGINS = [
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
] as const

/* A medium icon (24dp) sits in a 34dp circle. In the header that box is the whole touch
 * target: Android drops a touch outside the parent's bounds before `hitSlop` sees it, and
 * the native header item sizes itself to the margin box, so the growth must stay in it. */
describe("GaloyIconButton touchPadding", () => {
  it("grows the box by the padding on every side", () => {
    const style = buttonStyle(
      <GaloyIconButton name="menu" size="medium" iconOnly touchPadding={7} />,
    )

    expect(style).toMatchObject({
      width: 48,
      height: 48,
      paddingTop: 7,
      paddingRight: 7,
      paddingBottom: 7,
      paddingLeft: 7,
    })
  })

  it("grows only the sides it is given", () => {
    const style = buttonStyle(
      <GaloyIconButton
        name="menu"
        size="medium"
        iconOnly
        touchPadding={{ top: 7, right: 7, left: 7 }}
      />,
    )

    expect(style).toMatchObject({
      width: 48,
      height: 41,
      paddingTop: 7,
      paddingBottom: 0,
    })
  })

  it("never takes the growth back with negative margins", () => {
    const style = buttonStyle(
      <GaloyIconButton name="menu" size="medium" iconOnly touchPadding={7} />,
    )

    MARGINS.forEach((side) => expect(style[side] ?? 0).toBeGreaterThanOrEqual(0))
  })

  it("keeps the caller's own margins as they are", () => {
    const style = buttonStyle(
      <GaloyIconButton
        name="close"
        size="medium"
        touchPadding={7}
        style={callerMargins.close}
      />,
      "close",
    )

    expect(style).toMatchObject({ width: 48, marginRight: 13, marginVertical: 2 })
  })

  /** Past the parent, `hitSlop` is drawn by the touchables inspector but never gets a
   *  touch, so with a real box it would only overstate the target. */
  it("drops hitSlop once the touch box is real", () => {
    const { getByTestId } = renderWithTheme(
      <GaloyIconButton name="menu" size="medium" iconOnly touchPadding={7} />,
    )

    expect(getByTestId("menu").props.hitSlop).toBe(0)
  })

  it("keeps the 34dp box when no touch padding is asked for", () => {
    const style = buttonStyle(<GaloyIconButton name="menu" size="medium" iconOnly />)

    expect(style).toMatchObject({ width: 34, height: 34 })
    expect(style.paddingTop).toBeUndefined()
  })

  it("ignores the touch padding on a button with text, which lays out by its label", () => {
    const style = buttonStyle(
      <GaloyIconButton name="menu" size="medium" text="Menu" touchPadding={7} />,
      "Menu",
    )

    expect(style.width).toBeUndefined()
  })
})
