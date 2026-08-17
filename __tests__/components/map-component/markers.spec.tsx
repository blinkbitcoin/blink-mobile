import React from "react"
import { act, render, renderHook } from "@testing-library/react-native"
import { Circle, Path } from "react-native-svg"
import { ThemeProvider, createTheme } from "@rn-vui/themed"

import { BtcMapPlace } from "@app/btcmap"
import theme from "@app/rne-theme/theme"
import { dark, light } from "@app/rne-theme/colors"
import { ClusterMarker } from "@app/components/map-component/cluster-marker"
import {
  PlaceMarker,
  markerAnchor,
  markerHeight,
} from "@app/components/map-component/place-marker"
import {
  PIN_COLOR_BOOSTED,
  PIN_COLOR_DARK,
  PIN_HEIGHT,
} from "@app/components/map-component/pin-shape"
import { useMarkerSettle } from "@app/components/map-component/use-marker-settle"

jest.mock("react-native-maps", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    __esModule: true,
    Marker: (props: Record<string, unknown> & { children?: React.ReactNode }) =>
      ReactActual.createElement(
        RN.View,
        { testID: props.testID as string, ...props },
        props.children as React.ReactNode,
      ),
  }
})

const place = (overrides: Partial<BtcMapPlace> = {}): BtcMapPlace => ({
  id: 1,
  latitude: 51.5,
  longitude: -0.12,
  icon: "local_cafe",
  ...overrides,
})

const withTheme = (node: React.ReactElement) => (
  <ThemeProvider theme={theme}>{node}</ThemeProvider>
)

const inMode = (mode: "light" | "dark", node: React.ReactElement) => (
  <ThemeProvider theme={createTheme({ lightColors: light, darkColors: dark, mode })}>
    {node}
  </ThemeProvider>
)

const pinFill = (node: React.ReactElement) =>
  // eslint-disable-next-line camelcase -- testing-library exposes this verbatim
  render(node).UNSAFE_getAllByType(Path)[0].props.fill

const trackingOf = (tree: ReturnType<typeof render>, testID: string) =>
  tree.getByTestId(testID).props.tracksViewChanges

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe("useMarkerSettle", () => {
  it("keeps tracking on long enough for the marker to paint, then stops", () => {
    // Tracking on forever is ruinous with hundreds of pins; off from the first
    // frame snapshots a blank marker on Android.
    const { result } = renderHook(() => useMarkerSettle("a"))
    expect(result.current).toBe(true)

    act(() => jest.advanceTimersByTime(500))
    expect(result.current).toBe(false)
  })

  it("re-opens the window when what is drawn changes", () => {
    // Android keeps serving the cached bitmap once tracking is off, so a change
    // that never re-enables it never repaints.
    const { result, rerender } = renderHook(
      ({ appearance }: { appearance: string }) => useMarkerSettle(appearance),
      { initialProps: { appearance: "a" } },
    )
    act(() => jest.advanceTimersByTime(500))
    expect(result.current).toBe(false)

    rerender({ appearance: "b" })
    expect(result.current).toBe(true)
  })
})

describe("PlaceMarker", () => {
  it("settles its tracking flag after mounting", () => {
    const tree = render(withTheme(<PlaceMarker place={place()} onPress={jest.fn()} />))
    expect(trackingOf(tree, "btcmap-place-1")).toBe(true)

    act(() => jest.advanceTimersByTime(500))
    expect(trackingOf(tree, "btcmap-place-1")).toBe(false)
  })

  it("fills from the app's palette, not btcmap.org's teal", () => {
    // Light takes the theme accent; dark cannot, because primary lightens to
    // amber there and would collide with the boosted pin.
    expect(
      pinFill(inMode("light", <PlaceMarker place={place()} onPress={jest.fn()} />)),
    ).toBe(light.primary)
    expect(
      pinFill(inMode("dark", <PlaceMarker place={place()} onPress={jest.fn()} />)),
    ).toBe(PIN_COLOR_DARK)
  })

  it("marks a boosted place out in both themes", () => {
    const boosted = place({
      boostedUntil: new Date(Date.now() + 86_400_000).toISOString(),
    })

    for (const mode of ["light", "dark"] as const) {
      expect(
        pinFill(inMode(mode, <PlaceMarker place={boosted} onPress={jest.fn()} />)),
      ).toBe(PIN_COLOR_BOOSTED)
    }
  })

  it("keeps the teardrop tip on the coordinate whether or not it is labelled", () => {
    // The anchor is the tip's position as a fraction of the view. A label makes
    // the view taller, so a constant anchor would push labelled pins north of
    // where the merchant actually is.
    expect(markerAnchor(false)).toEqual({ x: 0.5, y: 1 })

    const labelled = markerAnchor(true)
    expect(labelled.x).toBe(0.5)
    expect(labelled.y).toBeCloseTo(PIN_HEIGHT / markerHeight(true), 5)
    expect(labelled.y).toBeLessThan(1)

    const anchorOf = (name?: string) =>
      render(
        withTheme(<PlaceMarker place={place()} name={name} onPress={jest.fn()} />),
      ).getByTestId("btcmap-place-1").props.anchor

    expect(anchorOf()).toEqual(markerAnchor(false))
    expect(anchorOf("Satoshi Coffee")).toEqual(markerAnchor(true))
  })

  it("draws the merchant's name under the pin when one is known", () => {
    const withName = render(
      withTheme(
        <PlaceMarker place={place()} name="Satoshi Coffee" onPress={jest.fn()} />,
      ),
    )
    expect(withName.getByText("Satoshi Coffee")).toBeTruthy()

    // No name yet means no label and no reserved space for one.
    const without = render(withTheme(<PlaceMarker place={place()} onPress={jest.fn()} />))
    expect(without.queryByText("Satoshi Coffee")).toBeNull()
  })

  it("repaints when a name arrives after the pin has already painted", () => {
    // Tracking is off 400ms after mount, and Android then serves the cached
    // bitmap — a label that never reopens the window never appears.
    const tree = render(withTheme(<PlaceMarker place={place()} onPress={jest.fn()} />))
    act(() => jest.advanceTimersByTime(500))
    expect(trackingOf(tree, "btcmap-place-1")).toBe(false)

    tree.rerender(
      withTheme(
        <PlaceMarker place={place()} name="Satoshi Coffee" onPress={jest.fn()} />,
      ),
    )

    expect(trackingOf(tree, "btcmap-place-1")).toBe(true)
  })

  it("repaints when a sync flips the place's boost", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    const tree = render(withTheme(<PlaceMarker place={place()} onPress={jest.fn()} />))
    act(() => jest.advanceTimersByTime(500))

    tree.rerender(
      withTheme(
        <PlaceMarker place={place({ boostedUntil: future })} onPress={jest.fn()} />,
      ),
    )

    expect(trackingOf(tree, "btcmap-place-1")).toBe(true)
  })
})

describe("ClusterMarker", () => {
  const cluster = (count: number) => ({
    id: "7",
    latitude: 51.5,
    longitude: -0.12,
    count,
  })

  it("settles its tracking flag rather than starting frozen", () => {
    // Starting at false is the blank-disc failure mode on Android.
    const tree = render(
      withTheme(<ClusterMarker cluster={cluster(4)} onPress={jest.fn()} />),
    )
    expect(trackingOf(tree, "btcmap-cluster-7")).toBe(true)

    act(() => jest.advanceTimersByTime(500))
    expect(trackingOf(tree, "btcmap-cluster-7")).toBe(false)
  })

  it("repaints when the count changes", () => {
    const tree = render(
      withTheme(<ClusterMarker cluster={cluster(4)} onPress={jest.fn()} />),
    )
    act(() => jest.advanceTimersByTime(500))

    tree.rerender(withTheme(<ClusterMarker cluster={cluster(40)} onPress={jest.fn()} />))

    expect(trackingOf(tree, "btcmap-cluster-7")).toBe(true)
  })

  it("keeps one accent colour whatever the count, distinguished by opacity", () => {
    // btcmap.org steps green to amber to orange with the count; here the disc's
    // size already carries that, so the colour stays put and only the number
    // moves. Both discs share the accent and differ only in opacity.
    const discsFor = (count: number) =>
      render(withTheme(<ClusterMarker cluster={cluster(count)} onPress={jest.fn()} />))
        // eslint-disable-next-line camelcase -- testing-library exposes this verbatim
        .UNSAFE_getAllByType(Circle)
        .map((circle) => ({
          fill: circle.props.fill,
          opacity: circle.props.fillOpacity,
        }))

    const small = discsFor(4)
    expect(small.map((disc) => disc.fill)).toEqual([small[0].fill, small[0].fill])
    expect(small[0].opacity).toBeLessThan(small[1].opacity)

    for (const count of [10, 99, 100, 5000]) {
      expect(discsFor(count).map((disc) => disc.fill)).toEqual(
        small.map((disc) => disc.fill),
      )
    }
  })

  it("takes its colour from the theme rather than a hardcoded palette", () => {
    const fill = render(
      withTheme(<ClusterMarker cluster={cluster(4)} onPress={jest.fn()} />),
    )
      // eslint-disable-next-line camelcase -- testing-library exposes this verbatim
      .UNSAFE_getAllByType(Circle)[0].props.fill

    // Guards the assertion against passing vacuously if the key ever stops
    // resolving: an undefined fill renders an invisible disc.
    expect(fill).toMatch(/^#[0-9a-f]{6}$/i)
    expect(fill).toBe(theme.lightColors?.success)
  })
})
