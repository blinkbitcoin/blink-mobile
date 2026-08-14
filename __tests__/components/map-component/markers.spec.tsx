import React from "react"
import { act, render, renderHook } from "@testing-library/react-native"
import { Circle } from "react-native-svg"
import { ThemeProvider } from "@rn-vui/themed"

import { BtcMapPlace } from "@app/btcmap"
import theme from "@app/rne-theme/theme"
import { ClusterMarker } from "@app/components/map-component/cluster-marker"
import { PlaceMarker } from "@app/components/map-component/place-marker"
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

  it("repaints when the count crosses a colour tier", () => {
    const tree = render(
      withTheme(<ClusterMarker cluster={cluster(4)} onPress={jest.fn()} />),
    )
    act(() => jest.advanceTimersByTime(500))

    tree.rerender(withTheme(<ClusterMarker cluster={cluster(40)} onPress={jest.fn()} />))

    expect(trackingOf(tree, "btcmap-cluster-7")).toBe(true)
  })

  it("steps disc colour at BTC Map's own count thresholds", () => {
    const fillsFor = (count: number) =>
      render(withTheme(<ClusterMarker cluster={cluster(count)} onPress={jest.fn()} />))
        // eslint-disable-next-line camelcase -- testing-library exposes this verbatim
        .UNSAFE_getAllByType(Circle)
        .map((circle) => circle.props.fill)

    expect(fillsFor(9)).not.toEqual(fillsFor(10))
    expect(fillsFor(10)).toEqual(fillsFor(99))
    expect(fillsFor(99)).not.toEqual(fillsFor(100))
  })
})
