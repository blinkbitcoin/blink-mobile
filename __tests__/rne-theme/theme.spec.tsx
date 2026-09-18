import React from "react"
import { Platform, StyleSheet } from "react-native"

import { render } from "@testing-library/react-native"
import { Text, TextProps, ThemeProvider } from "@rn-vui/themed"

import { fonts } from "@app/rne-theme/fonts"
import theme from "@app/rne-theme/theme"

const renderedStyle = (props: TextProps) => {
  const { getByText } = render(
    <ThemeProvider theme={theme}>
      <Text {...props}>text</Text>
    </ThemeProvider>,
  )
  return StyleSheet.flatten(getByText("text").props.style)
}

const types = ["h1", "h2", "p1", "p2", "p3", "p4", undefined] as const

describe("theme Text", () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Platform.OS = originalOS
  })

  describe("on Android", () => {
    beforeEach(() => {
      Platform.OS = "android"
    })

    types.forEach((type) => {
      it(`renders bold ${type ?? "without a type"} with the bold face and no bold weight`, () => {
        const style = renderedStyle({ type, bold: true })

        expect(style.fontFamily).toBe(fonts.bold)
        // A weight of 700+ makes Android look for `SourceSansPro-Bold_bold.ttf` and fall back to Roboto
        expect(["normal", "400", undefined]).toContain(style.fontWeight)
      })
    })

    it("renders text that is not bold with the regular face", () => {
      const style = renderedStyle({ type: "p2" })

      expect(style.fontFamily).toBe(fonts.regular)
      expect(["normal", "400", undefined]).toContain(style.fontWeight)
    })
  })

  describe("on iOS", () => {
    beforeEach(() => {
      Platform.OS = "ios"
    })

    types.forEach((type) => {
      it(`renders bold ${type ?? "without a type"} with the bold face at 700`, () => {
        const style = renderedStyle({ type, bold: true })

        expect(style.fontFamily).toBe(fonts.bold)
        expect(style.fontWeight).toBe("700")
      })
    })

    it("renders text that is not bold with the regular face and no weight", () => {
      const style = renderedStyle({ type: "p2" })

      expect(style.fontFamily).toBe(fonts.regular)
      expect(style.fontWeight).toBeUndefined()
    })
  })
})
