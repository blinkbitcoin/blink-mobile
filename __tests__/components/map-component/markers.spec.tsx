import React from "react"
import { StyleSheet, View } from "react-native"
import { act, render, renderHook } from "@testing-library/react-native"
import { Circle, Path } from "react-native-svg"
import MaterialIcon from "react-native-vector-icons/MaterialIcons"
import { ThemeProvider, createTheme } from "@rn-vui/themed"

import { BtcMapPlace } from "@app/btcmap"
import theme from "@app/rne-theme/theme"
import { dark, light } from "@app/rne-theme/colors"
import { ClusterMarker } from "@app/components/map-component/cluster-marker"
import { labelBox, projectToScreen } from "@app/components/map-component/label-collision"
import {
  LABEL_ANCHOR,
  LABEL_FONT_SIZE,
  LABEL_HALO_PADDING,
  LABEL_LINE_HEIGHT,
  LABEL_MAX_WIDTH,
  PIN_ANCHOR,
} from "@app/components/map-component/marker-layout"
import {
  LABEL_HALO_COLOR_LIGHT,
  PlaceLabelMarker,
} from "@app/components/map-component/place-label-marker"
import { PlaceMarker } from "@app/components/map-component/place-marker"
import {
  PIN_COLOR_BOOSTED,
  PIN_COLOR_DARK,
  PIN_HEIGHT,
} from "@app/components/map-component/pin-shape"
import { useMarkerSettle } from "@app/components/map-component/use-marker-settle"

// Every Marker the components mount records its redraw() here, keyed by testID,
// so the tests can assert the native icon was forced to refresh.
const redraws: Record<string, jest.Mock> = {}

jest.mock("react-native-maps", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    __esModule: true,
    Marker: ReactActual.forwardRef(
      (
        props: Record<string, unknown> & { children?: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => {
        const testID = props.testID as string
        ReactActual.useImperativeHandle(ref, () => {
          redraws[testID] = redraws[testID] ?? jest.fn()
          return { redraw: redraws[testID] }
        })
        return ReactActual.createElement(
          RN.View,
          { testID, ...props },
          props.children as React.ReactNode,
        )
      },
    ),
  }
})

const redrawsFor = (testID: string) => redraws[testID]?.mock.calls.length ?? 0

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

const glyphColor = (node: React.ReactElement) =>
  // eslint-disable-next-line camelcase -- testing-library exposes this verbatim
  render(node).UNSAFE_getAllByType(
    // Types-only gap: @types/react-native-vector-icons resolves a nested
    // @types/react, so Icon's class type is not the ComponentType this React
    // declares. It is the same component at runtime, which is what matches.
    MaterialIcon as unknown as React.ComponentType,
  )[0].props.color

const trackingOf = (tree: ReturnType<typeof render>, testID: string) =>
  tree.getByTestId(testID).props.tracksViewChanges

beforeEach(() => {
  jest.useFakeTimers()
  for (const key of Object.keys(redraws)) delete redraws[key]
})
afterEach(() => jest.useRealTimers())

describe("useMarkerSettle", () => {
  it("keeps tracking on long enough for the marker to paint, then stops", () => {
    // Tracking on forever is ruinous with hundreds of pins; off from the first
    // frame snapshots a blank marker on Android.
    const { result } = renderHook(() => useMarkerSettle("a"))
    expect(result.current.tracksViewChanges).toBe(true)

    act(() => jest.advanceTimersByTime(500))
    expect(result.current.tracksViewChanges).toBe(false)
  })

  it("re-opens the window when what is drawn changes", () => {
    // Android keeps serving the cached bitmap once tracking is off, so a change
    // that never re-enables it never repaints.
    const { result, rerender } = renderHook(
      ({ appearance }: { appearance: string }) => useMarkerSettle(appearance),
      { initialProps: { appearance: "a" } },
    )
    act(() => jest.advanceTimersByTime(500))
    expect(result.current.tracksViewChanges).toBe(false)

    rerender({ appearance: "b" })
    expect(result.current.tracksViewChanges).toBe(true)
  })

  it("forces the rasterisation more than once, well past the tracking window", () => {
    // Android's tracker stops re-capturing a couple of frames after the view
    // changed, whatever the prop says, and the library's own final-render
    // fallback is behind an early return that trips once it has. So the icon is
    // refreshed by hand — and more than once, because a single delay that suits
    // a fast phone is not enough on a loaded emulator, where a capture taken too
    // early freezes a half-drawn pin for good.
    const redraw = jest.fn()
    const { rerender } = renderHook(
      ({ appearance }: { appearance: string }) => {
        const settle = useMarkerSettle(appearance)
        // @ts-expect-error -- standing in for the native marker handle
        settle.markerRef.current = { redraw }
        return settle
      },
      { initialProps: { appearance: "a" } },
    )

    expect(redraw).not.toHaveBeenCalled()

    // The first pass lands as the window closes...
    act(() => jest.advanceTimersByTime(500))
    expect(redraw).toHaveBeenCalledTimes(1)

    // ...and at least one more follows it, long after tracking stopped.
    act(() => jest.advanceTimersByTime(2000))
    expect(redraw.mock.calls.length).toBeGreaterThan(1)

    // The whole schedule runs again each time the window is reopened.
    const beforeReopen = redraw.mock.calls.length
    rerender({ appearance: "b" })
    act(() => jest.advanceTimersByTime(2500))
    expect(redraw.mock.calls).toHaveLength(beforeReopen * 2)
  })

  it("drops the pending redraws when the window is reopened before they fire", () => {
    // Capturing mid-change is the failure being avoided, so a superseded
    // schedule must not leave a stray timer behind to do exactly that.
    const redraw = jest.fn()
    const { rerender } = renderHook(
      ({ appearance }: { appearance: string }) => {
        const settle = useMarkerSettle(appearance)
        // @ts-expect-error -- standing in for the native marker handle
        settle.markerRef.current = { redraw }
        return settle
      },
      { initialProps: { appearance: "a" } },
    )

    act(() => jest.advanceTimersByTime(200))
    rerender({ appearance: "b" })
    act(() => jest.advanceTimersByTime(200))

    expect(redraw).not.toHaveBeenCalled()

    act(() => jest.advanceTimersByTime(300))
    expect(redraw).toHaveBeenCalledTimes(1)
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

  it("keeps the category glyph pinned white whatever the mode", () => {
    // Every fill a pin can take is a saturated accent, two of them fixed past
    // the theme entirely, so the glyph reads `_white` rather than the theme's
    // `white` — that one is the background token and inverts to black, which
    // would hollow the glyph out of the dark-mode periwinkle.
    for (const mode of ["light", "dark"] as const) {
      expect(
        glyphColor(inMode(mode, <PlaceMarker place={place()} onPress={jest.fn()} />)),
      ).toBe(light._white)
    }
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

  it("puts the teardrop tip on the coordinate with a constant anchor", () => {
    // The pin is alone in its view, so the tip is simply the view's bottom edge.
    expect(PIN_ANCHOR).toEqual({ x: 0.5, y: 1 })

    const tree = render(withTheme(<PlaceMarker place={place()} onPress={jest.fn()} />))
    expect(tree.getByTestId("btcmap-place-1").props.anchor).toEqual(PIN_ANCHOR)
  })

  it("draws nothing but the pin, whatever the place is called", () => {
    // The regression this guards: the view used to hold the label too, so it was
    // sized by the name's width and the pin's position inside its own bitmap
    // moved with the character count. Any bitmap captured against a different
    // layout then sliced the pin instead of shifting it.
    const tree = render(withTheme(<PlaceMarker place={place()} onPress={jest.fn()} />))

    expect(tree.UNSAFE_getAllByType(Path)).toHaveLength(1)
    expect(tree.queryByText("Satoshi Coffee")).toBeNull()

    const style = tree.getByTestId("btcmap-place-1").props.children.props.style
    expect(style).toEqual(expect.objectContaining({ width: 32, height: PIN_HEIGHT }))
  })

  it("does not repaint when a name arrives", () => {
    // A name reaches PlaceLabelMarker now, so the pin — long since rasterised
    // and frozen — is not asked to change at all.
    const tree = render(withTheme(<PlaceMarker place={place()} onPress={jest.fn()} />))
    act(() => jest.advanceTimersByTime(2500))
    expect(trackingOf(tree, "btcmap-place-1")).toBe(false)
    const settled = redrawsFor("btcmap-place-1")

    tree.rerender(withTheme(<PlaceMarker place={place()} onPress={jest.fn()} />))

    expect(trackingOf(tree, "btcmap-place-1")).toBe(false)
    expect(redrawsFor("btcmap-place-1")).toBe(settled)
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

const label = () => (
  <PlaceLabelMarker place={place()} name="Satoshi Coffee" onPress={jest.fn()} />
)

const textStyleOf = (node: React.ReactElement) =>
  StyleSheet.flatten(render(node).getByText("Satoshi Coffee").props.style)

const haloOf = (node: React.ReactElement) => textStyleOf(node).textShadowColor

// The only styled View in the label's marker is the row that pads the text away
// from the coordinate its bottom-left corner sits on.
const rowStyleOf = (node: React.ReactElement) =>
  StyleSheet.flatten(
    // eslint-disable-next-line camelcase -- testing-library exposes this verbatim
    render(node)
      .UNSAFE_getAllByType(View)
      .map((view) => StyleSheet.flatten(view.props.style))
      .find((style) => style?.paddingLeft !== undefined),
  )

describe("PlaceLabelMarker", () => {
  it("stands the name beside the pin, anchored by a corner a name cannot move", () => {
    // Bottom-left, not centred: the view's width follows its text, and only a
    // corner the growth runs away from stays put for every name. Centring it
    // would also put the name back under the tip, which is the placement that
    // made two pins a thumb apart collide — see marker-layout.ts.
    expect(LABEL_ANCHOR).toEqual({ x: 0, y: 1 })

    const tree = render(
      withTheme(
        <PlaceLabelMarker place={place()} name="Satoshi Coffee" onPress={jest.fn()} />,
      ),
    )

    expect(tree.getByText("Satoshi Coffee")).toBeTruthy()
    const marker = tree.getByTestId("btcmap-label-1")
    expect(marker.props.anchor).toEqual(LABEL_ANCHOR)
    expect(marker.props.coordinate).toEqual({ latitude: 51.5, longitude: -0.12 })
  })

  it("settles and forces its paint like every other marker", () => {
    const tree = render(
      withTheme(
        <PlaceLabelMarker place={place()} name="Satoshi Coffee" onPress={jest.fn()} />,
      ),
    )
    expect(trackingOf(tree, "btcmap-label-1")).toBe(true)

    act(() => jest.advanceTimersByTime(2500))
    expect(trackingOf(tree, "btcmap-label-1")).toBe(false)
    expect(redrawsFor("btcmap-label-1")).toBeGreaterThan(1)
  })

  it("darkens the halo in light mode, where a white one is swallowed", () => {
    // `colors.white` is the background token and is #FFFFFF in light mode, which
    // over a pale basemap leaves the glyphs nothing but their own weight to
    // stand on. Dark mode needs no equivalent: the same token is already black
    // there, behind white text.
    expect(haloOf(inMode("light", label()))).toBe(LABEL_HALO_COLOR_LIGHT)
    expect(haloOf(inMode("light", label()))).not.toBe(light.white)

    expect(haloOf(inMode("dark", label()))).toBe(dark.white)
    expect(textStyleOf(inMode("dark", label())).color).toBe(dark.black)
  })

  it("draws the name in the pixels the collision pass reserved for it", () => {
    // The two halves of this are written in different files and neither can see
    // the other: `label-collision.ts` reserves a rectangle in screen space, and
    // the padding below is what actually puts the glyphs somewhere. Change one
    // and the boxes stop describing the pixels — labels drift off the strip
    // that was held for them, or overlap one the pass believed was clear.
    const frame = {
      region: {
        latitude: 51.5,
        longitude: -0.12,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      viewport: { width: 384, height: 720 },
    }
    const shop = place()
    const reserved = labelBox(shop, "Satoshi Coffee", frame)
    const { x, y } = projectToScreen(shop, frame)

    const text = textStyleOf(withTheme(label()))
    const row = rowStyleOf(withTheme(label()))

    // The marker's bottom-left corner is on the coordinate, so the padding is
    // measured from (x, y) and the text sits inside it.
    const drawn = {
      left: x + Number(row.paddingLeft),
      bottom: y - Number(row.paddingBottom),
      height: Number(text.height),
    }

    expect(drawn.left).toBe(reserved.left + LABEL_HALO_PADDING)
    expect(drawn.bottom - drawn.height / 2).toBe((reserved.top + reserved.bottom) / 2)
    expect(drawn.height).toBe(reserved.bottom - reserved.top - LABEL_HALO_PADDING * 2)

    // And the widest the text may draw is the widest a box is ever reserved.
    expect(text.maxWidth).toBe(LABEL_MAX_WIDTH)
    expect(text.fontSize).toBe(LABEL_FONT_SIZE)
    expect(text.lineHeight).toBe(LABEL_LINE_HEIGHT)
    expect(row.paddingTop).toBe(LABEL_HALO_PADDING)
    expect(row.paddingRight).toBe(LABEL_HALO_PADDING)
  })

  it("opens the place when the name is tapped, not just the pin", () => {
    const onPress = jest.fn()
    const tree = render(
      withTheme(
        <PlaceLabelMarker place={place()} name="Satoshi Coffee" onPress={onPress} />,
      ),
    )

    tree.getByTestId("btcmap-label-1").props.onPress()
    expect(onPress).toHaveBeenCalledWith(place())
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

  it("takes its colour from our palette rather than the library's", () => {
    const fill = render(
      withTheme(<ClusterMarker cluster={cluster(4)} onPress={jest.fn()} />),
    )
      // eslint-disable-next-line camelcase -- testing-library exposes this verbatim
      .UNSAFE_getAllByType(Circle)[0].props.fill

    // Guards the assertion against passing vacuously if the key ever stops
    // resolving: an undefined fill renders an invisible disc.
    expect(fill).toMatch(/^#[0-9a-f]{6}$/i)
    // Read straight out of colors.ts, not off the built theme: createTheme
    // backfills @rn-vui's defaults for every key we leave unset, so a token we
    // do not define still answers — with a library colour, and against a theme
    // lookup it compares equal to itself.
    expect(fill).toBe(light._green)
  })
})
