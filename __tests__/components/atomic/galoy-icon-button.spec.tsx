import React from "react"
import { StyleSheet } from "react-native"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import theme from "@app/rne-theme/theme"

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

const callerMargins = StyleSheet.create({ close: { marginRight: 20, marginVertical: 2 } })

const buttonStyle = (ui: React.ReactElement, testID = "menu") =>
  StyleSheet.flatten(renderWithTheme(ui).getByTestId(testID).props.style)

/* A medium icon (24dp) sits in a 34dp circle. In the header that box is the whole touch
 * target: Android drops a touch outside the parent's bounds before `hitSlop` sees it. */
describe("GaloyIconButton touchSize", () => {
  it("grows the touch box to the size asked for", () => {
    const style = buttonStyle(
      <GaloyIconButton name="menu" size="medium" iconOnly touchSize={42} />,
    )

    expect(style).toMatchObject({ width: 42, height: 42 })
  })

  it("takes the growth back with margins, so the button keeps its footprint", () => {
    const style = buttonStyle(
      <GaloyIconButton name="menu" size="medium" iconOnly touchSize={42} />,
    )

    expect(style).toMatchObject({
      marginTop: -4,
      marginRight: -4,
      marginBottom: -4,
      marginLeft: -4,
    })
  })

  it("keeps the caller's own margins on top of the growth", () => {
    const style = buttonStyle(
      <GaloyIconButton
        name="close"
        size="medium"
        touchSize={42}
        style={callerMargins.close}
      />,
      "close",
    )

    expect(style).toMatchObject({
      marginRight: 16,
      marginLeft: -4,
      marginTop: -2,
      marginBottom: -2,
    })
  })

  it("leaves a button already bigger than the touch size alone", () => {
    const style = buttonStyle(
      <GaloyIconButton name="close" size="large" iconOnly touchSize={42} />,
      "close",
    )

    expect(style).toMatchObject({ width: 51, height: 51, marginLeft: 0, marginTop: 0 })
  })

  it("keeps the 34dp box when no touch size is asked for", () => {
    const style = buttonStyle(<GaloyIconButton name="menu" size="medium" iconOnly />)

    expect(style).toMatchObject({ width: 34, height: 34 })
    expect(style.marginLeft).toBeUndefined()
  })

  it("ignores the touch size on a button with text, which lays out by its label", () => {
    const style = buttonStyle(
      <GaloyIconButton name="menu" size="medium" text="Menu" touchSize={42} />,
      "Menu",
    )

    expect(style.width).toBeUndefined()
  })
})
