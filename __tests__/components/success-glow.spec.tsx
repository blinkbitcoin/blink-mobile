import React from "react"
import { it } from "@jest/globals"
import { StyleSheet } from "react-native"
import { getAnimatedStyle, useSharedValue } from "react-native-reanimated"
import { ReactTestInstance } from "react-test-renderer"
import { render, screen } from "@testing-library/react-native"
import { createTheme, ThemeProvider } from "@rn-vui/themed"

import { SuccessGlow } from "@app/components/success-glow"
import { dark, light } from "@app/rne-theme/colors"

const FRAME = { centerX: 180, centerY: 400, radius: 800 }

const Glow = ({ progress }: { progress: number }) => {
  const shared = useSharedValue(progress)
  return <SuccessGlow progress={shared} {...FRAME} />
}

const renderGlow = (progress: number, mode: "light" | "dark" = "light") =>
  render(
    <ThemeProvider theme={createTheme({ lightColors: light, darkColors: dark, mode })}>
      <Glow progress={progress} />
    </ThemeProvider>,
  )

/** The one view the gradient is drawn on. */
const bloom = (): ReactTestInstance =>
  screen.UNSAFE_root.findAll(
    (node) =>
      typeof node.type === "string" &&
      StyleSheet.flatten(node.props.style)?.experimental_backgroundImage !== undefined,
  )[0]

const gradient = () =>
  StyleSheet.flatten(bloom().props.style).experimental_backgroundImage as string

describe("SuccessGlow", () => {
  it("draws a circle of the full radius around the centre it is given", () => {
    renderGlow(1)

    expect(StyleSheet.flatten(bloom().props.style)).toMatchObject({
      position: "absolute",
      left: FRAME.centerX - FRAME.radius,
      top: FRAME.centerY - FRAME.radius,
      width: FRAME.radius * 2,
      height: FRAME.radius * 2,
      borderRadius: FRAME.radius,
    })
  })

  /** Grown by scale alone, so it starts at the centre and a re-render can't move it. */
  it("grows by scale from a speck to full size", () => {
    renderGlow(0)
    expect(getAnimatedStyle(bloom())).toMatchObject({ transform: [{ scale: 0.001 }] })
    screen.unmount()

    renderGlow(1)
    expect(getAnimatedStyle(bloom())).toMatchObject({ transform: [{ scale: 1 }] })
  })

  it("takes no touches, so the actions over it stay pressable", () => {
    renderGlow(1)

    let wrapper = bloom().parent
    while (wrapper && wrapper.props.pointerEvents === undefined) wrapper = wrapper.parent

    expect(wrapper?.props.pointerEvents).toBe("none")
  })

  /** Theme tokens both ways, so it lifts off black and sinks into white. */
  it.each([
    ["light", light],
    ["dark", dark],
  ] as const)(
    "runs from the ground to the pressed surface in %s mode",
    (mode, colors) => {
      renderGlow(1, mode)

      expect(gradient()).toBe(
        `radial-gradient(circle farthest-corner, ${colors.backgroundDefault} 0%, ` +
          `${colors.backgroundDefault} 19.80%, ${colors.surfacePressed} 70.71%, ` +
          `transparent 70.71%)`,
      )
    },
  )
})
