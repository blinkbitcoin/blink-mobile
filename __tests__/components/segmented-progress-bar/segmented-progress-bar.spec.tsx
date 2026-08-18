import React from "react"
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import { render, screen, act } from "@testing-library/react-native"
import type { ReactTestRendererJSON, ReactTestRendererNode } from "react-test-renderer"

import { ThemeProvider } from "@rn-vui/themed"

import { SegmentedProgressBar } from "@app/components/segmented-progress-bar"
import { light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"

const FILL_COLOR = "#00A700"

const renderBar = (total: number, filled: number) =>
  render(
    <ThemeProvider theme={theme}>
      <SegmentedProgressBar total={total} filled={filled} fillColor={FILL_COLOR} />
    </ThemeProvider>,
  )

const rerenderBar = (total: number, filled: number) =>
  screen.rerender(
    <ThemeProvider theme={theme}>
      <SegmentedProgressBar total={total} filled={filled} fillColor={FILL_COLOR} />
    </ThemeProvider>,
  )

const styleOf = (node: ReactTestRendererJSON) =>
  StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>)

/** The rendered bar: a single root View, always, even with no segments. */
const renderedBar = (): ReactTestRendererJSON => {
  const tree = screen.toJSON()

  if (!tree || Array.isArray(tree)) {
    throw new Error("expected the bar to render a single root node")
  }

  return tree
}

const widthsWithin = (node: ReactTestRendererNode): string[] => {
  if (typeof node === "string") return []

  const width = styleOf(node)?.width
  const own = typeof width === "string" ? [width] : []

  return [...own, ...(node.children ?? []).flatMap(widthsWithin)]
}

/**
 * The bar renders no text, so its state lives in the style tree: an animated
 * fill inside each segment, sized 0% or 100%. The walk starts below the root
 * because the bar's own container carries a width too.
 */
const fillWidths = (): string[] => (renderedBar().children ?? []).flatMap(widthsWithin)

const segmentTrackColors = () =>
  (renderedBar().children ?? []).map((segment) =>
    typeof segment === "string" ? undefined : styleOf(segment)?.backgroundColor,
  )

/** The component animates for 120ms; 200ms drains every pending frame. */
const settleAnimations = () => {
  act(() => {
    jest.advanceTimersByTime(200)
  })
}

describe("SegmentedProgressBar", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    settleAnimations()
    jest.useRealTimers()
  })

  it("fills exactly the leading segments the progress covers", () => {
    renderBar(4, 2)

    expect(fillWidths()).toEqual(["100%", "100%", "0%", "0%"])
  })

  it("fills nothing at zero progress and every segment at full progress", () => {
    const { unmount } = renderBar(3, 0)

    expect(fillWidths()).toEqual(["0%", "0%", "0%"])

    unmount()
    renderBar(3, 3)

    expect(fillWidths()).toEqual(["100%", "100%", "100%"])
  })

  it("clamps a progress that overshoots the total", () => {
    renderBar(2, 5)

    expect(fillWidths()).toEqual(["100%", "100%"])
  })

  it("clamps a negative progress to empty", () => {
    renderBar(2, -1)

    expect(fillWidths()).toEqual(["0%", "0%"])
  })

  it("renders no segments for an empty total", () => {
    renderBar(0, 0)

    expect(fillWidths()).toEqual([])
  })

  it("paints the track behind every segment, filled or not", () => {
    renderBar(2, 1)

    expect(segmentTrackColors()).toEqual([light.grey4, light.grey4])
    expect(fillWidths()).toEqual(["100%", "0%"])
  })

  /** Decorative by design: the score or step labels beside the bar already say
   *  what it shows, so it must not become an unnamed control. */
  it("stays out of the accessibility tree", () => {
    renderBar(4, 3)

    expect(screen.queryByRole("progressbar")).toBeNull()
  })

  describe("animation", () => {
    let timing: jest.SpyInstance

    beforeAll(() => {
      timing = jest.spyOn(Animated, "timing")
    })

    beforeEach(() => {
      timing.mockClear()
    })

    afterAll(() => {
      timing.mockRestore()
    })

    it("does not animate on mount: a segment renders at its final width", () => {
      renderBar(2, 1)

      expect(timing).not.toHaveBeenCalled()
    })

    it("animates only the segment whose unit flips after mount", () => {
      renderBar(3, 1)

      rerenderBar(3, 2)
      settleAnimations()

      expect(timing).toHaveBeenCalledTimes(1)
      expect(fillWidths()).toEqual(["100%", "100%", "0%"])
    })

    it("animates a segment back out when progress falls away from it", () => {
      renderBar(3, 2)

      rerenderBar(3, 1)
      settleAnimations()

      expect(timing).toHaveBeenCalledTimes(1)
      expect(fillWidths()).toEqual(["100%", "0%", "0%"])
    })
  })
})
