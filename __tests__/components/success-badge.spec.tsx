import React from "react"
import { act, render, screen } from "@testing-library/react-native"
import Svg, { Path } from "react-native-svg"
import { createTheme, ThemeProvider } from "@rn-vui/themed"

import { SuccessBadge } from "@app/components/success-badge/success-badge"
import { light } from "@app/rne-theme/colors"

const theme = createTheme({ lightColors: light, mode: "light" })

const renderBadge = (props: React.ComponentProps<typeof SuccessBadge> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <SuccessBadge {...props} />
    </ThemeProvider>,
  )

describe("SuccessBadge", () => {
  it("draws the seal and the check in the success green by default", () => {
    renderBadge()

    const strokes = screen.UNSAFE_getAllByType(Path).map((path) => path.props.stroke)

    expect(strokes).toEqual([light._green, light._green])
  })

  it("draws in the colour it is given", () => {
    renderBadge({ color: "#123456" })

    const strokes = screen.UNSAFE_getAllByType(Path).map((path) => path.props.stroke)

    expect(strokes).toEqual(["#123456", "#123456"])
  })

  it("scales the drawing to the size it is given, keeping its own view box", () => {
    renderBadge({ size: 72 })

    const svg = screen.UNSAFE_getByType(Svg)

    expect(svg.props.width).toBe(72)
    expect(svg.props.height).toBe(72)
    expect(svg.props.viewBox).toBe("0 0 49 49")
  })

  it("parks each dash a full stroke clear of its path, so no round cap shows at rest", () => {
    renderBadge()

    screen.UNSAFE_getAllByType(Path).forEach((path) => {
      const [dash, gap] = path.props.strokeDasharray

      expect(gap - dash).toBeCloseTo(2 * path.props.strokeWidth)
    })
  })

  /** Sent shown at its end, after the lock screen cut its play off, has nothing to draw. */
  it("mounts fully drawn when asked to, and stays so", () => {
    jest.useFakeTimers()
    renderBadge({ isDrawn: true, delay: 150 })

    const offsets = () =>
      screen.UNSAFE_getAllByType(Path).map((path) => path.props.strokeDashoffset)
    expect(offsets()).toEqual([0, 0])

    act(() => jest.advanceTimersByTime(2000))
    expect(offsets()).toEqual([0, 0])
    jest.useRealTimers()
  })
})
