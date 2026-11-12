import React from "react"
import { StyleSheet, type TextStyle, type ViewStyle } from "react-native"
import { render, screen } from "@testing-library/react-native"
import { useTheme } from "@rn-vui/themed"

import {
  GaloyTertiaryButton,
  type GaloyTertiaryButtonProps,
} from "@app/components/atomic/galoy-tertiary-button"
import { ContextForScreen } from "../../screens/helper"

let colors: Record<string, string> = {}

/** Reads the theme the button renders with, so the assertions don't hardcode a palette. */
const ThemeProbe = () => {
  colors = useTheme().theme.colors as unknown as Record<string, string>
  return null
}

const renderButton = (props: Partial<GaloyTertiaryButtonProps> = {}) =>
  render(
    <ContextForScreen>
      <ThemeProbe />
      <GaloyTertiaryButton
        testID="button"
        title="Received"
        onPress={() => {}}
        {...props}
      />
    </ContextForScreen>,
  )

const containerStyle = () =>
  StyleSheet.flatten(screen.getByTestId("button").props.style) as ViewStyle

/** The Pressable's style function, called as it would be while the finger is down. */
const pressedStyle = () => {
  const pressable = screen
    .UNSAFE_getAllByProps({ testID: "button" })
    .find((node) => typeof node.props.style === "function")
  return StyleSheet.flatten(pressable?.props.style({ pressed: true })) as ViewStyle
}

const labelColor = () =>
  (StyleSheet.flatten(screen.getByText("Received").props.style) as TextStyle).color

describe("GaloyTertiaryButton", () => {
  describe("unfilled (Figma Filled=false)", () => {
    it("is a grey5 pill with no border", () => {
      renderButton({ unfilled: true })

      expect(containerStyle()).toMatchObject({
        backgroundColor: colors.surfaceInteractive,
      })
      expect(containerStyle().borderWidth).toBeUndefined()
    })

    it("turns grey6 while pressed", () => {
      renderButton({ unfilled: true })

      expect(pressedStyle()).toMatchObject({ backgroundColor: colors.surfacePressed })
      expect(pressedStyle().borderWidth).toBeUndefined()
    })

    it("draws its label in primary", () => {
      renderButton({ unfilled: true })

      expect(labelColor()).toBe(colors.accent)
    })
  })

  describe("without unfilled", () => {
    it("keeps the filled primary pill", () => {
      renderButton()

      expect(containerStyle()).toMatchObject({ backgroundColor: colors.accent })
      expect(labelColor()).toBe(colors.backgroundDefault)
    })

    it("keeps the outline style's primary border", () => {
      renderButton({ outline: true })

      expect(containerStyle()).toMatchObject({
        borderColor: colors.accent,
        borderWidth: 1.5,
      })
      expect(labelColor()).toBe(colors.textOnBackground)
    })
  })
})
