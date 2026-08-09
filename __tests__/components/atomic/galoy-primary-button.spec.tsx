import React from "react"
import { StyleSheet, View, type ViewStyle } from "react-native"
import { render, screen } from "@testing-library/react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { ContextForScreen } from "../../screens/helper"

const renderButton = (disabled: boolean) =>
  render(
    <ContextForScreen>
      <GaloyPrimaryButton title="Continue" disabled={disabled} onPress={() => {}} />
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

describe("GaloyPrimaryButton", () => {
  it("paints an opaque surface when disabled", () => {
    renderButton(true)
    const style = getButtonSurfaceStyle()

    // A translucent disabled button composites whatever sits behind it, so
    // content could read straight through the CTA. It has to own its pixels.
    expect(style.backgroundColor).toBeTruthy()
    expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
    expect(style.opacity === undefined || style.opacity === 1).toBe(true)
  })

  it("keeps a distinct surface between the enabled and disabled states", () => {
    renderButton(false)
    const enabledBackground = getButtonSurfaceStyle().backgroundColor
    screen.unmount()

    renderButton(true)
    const disabledBackground = getButtonSurfaceStyle().backgroundColor

    expect(disabledBackground).not.toBe(enabledBackground)
  })
})
