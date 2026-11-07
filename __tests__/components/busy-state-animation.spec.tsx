import React from "react"
import { StyleSheet, Text as RNText, type ViewStyle } from "react-native"
import { act, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"

/**
 * The motion itself, which the screen spec switches off. Reanimated's builders
 * are replaced with recorders, so the spec reads what was scheduled (delays,
 * durations, repeat, completion) and, by setting the shared values by hand, what
 * each animated style computes at any point of the entrance and the march.
 */

type SharedValue = { value: unknown }
const mockSharedValues: SharedValue[] = []
let mockReducedMotion = false

jest.mock("react-native-reanimated", () => {
  const { useRef } = jest.requireActual<typeof import("react")>("react")
  return {
    ...jest.requireActual<object>("react-native-reanimated"),
    __esModule: true,
    useSharedValue: (initial: number) => {
      const ref = useRef<SharedValue | null>(null)
      if (!ref.current) {
        ref.current = { value: initial }
        mockSharedValues.push(ref.current)
      }
      return ref.current
    },
    useAnimatedStyle: (worklet: () => object) => worklet(),
    useReducedMotion: () => mockReducedMotion,
    withDelay: (delay: number, animation: unknown) => ({ delay, animation }),
    withTiming: (
      toValue: number,
      config: { duration: number },
      callback?: (finished: boolean) => void,
    ) => ({ toValue, duration: config.duration, callback }),
    withRepeat: (animation: unknown, count: number, reverse: boolean) => ({
      repeat: animation,
      count,
      reverse,
    }),
    runOnJS: (fn: () => void) => () => fn(),
    cancelAnimation: jest.fn(),
  }
})

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => children ?? null,
  Line: () => null,
}))

// eslint-disable-next-line import/first
import { cancelAnimation } from "react-native-reanimated"

// eslint-disable-next-line import/first
import { BusyStateAnimation } from "@app/components/busy-state/busy-state-animation"
// eslint-disable-next-line import/first
import {
  CHIP_SIZE,
  CHIP_TRAVEL,
  CONNECTOR_LENGTH,
  DASH_PERIOD,
  DASH_TRAVEL_MS,
  ENTRANCE_DELAY_MS,
  ENTRANCE_DURATION_MS,
  Z_CONNECTOR,
  Z_ICON_1,
  Z_ICON_2,
} from "@app/components/busy-state/config"

type Recorded = {
  delay: number
  animation: {
    toValue?: number
    duration?: number
    callback?: (finished: boolean) => void
    repeat?: { toValue: number; duration: number }
    count?: number
    reverse?: boolean
  }
}

const pictogram = (onEntranceComplete?: () => void) => (
  <ThemeProvider theme={theme}>
    <BusyStateAnimation
      icon1={<RNText>icon1</RNText>}
      icon2={<RNText>icon2</RNText>}
      onEntranceComplete={onEntranceComplete}
    />
  </ThemeProvider>
)

const mount = (onEntranceComplete?: () => void) => {
  const view = render(pictogram(onEntranceComplete))
  const [progress, march] = mockSharedValues
  return { ...view, progress, march }
}

/** Each moving view, told apart by the style that only it has. */
const layers = (view: ReturnType<typeof render>) => {
  const styles = view.UNSAFE_root.findAll((node) => (node.type as string) === "View").map(
    (node) => StyleSheet.flatten(node.props.style) as ViewStyle,
  )
  const find = (match: (style: ViewStyle) => boolean) => {
    const style = styles.find((candidate) => candidate && match(candidate))
    if (!style) throw new Error("layer not found")
    return style
  }
  const translateX = (style: ViewStyle) =>
    (style.transform as Array<{ translateX: number }>)[0].translateX

  return {
    icon1X: translateX(find((style) => style.zIndex === Z_ICON_1)),
    icon2X: translateX(find((style) => style.zIndex === Z_ICON_2)),
    window: find((style) => style.zIndex === Z_CONNECTOR),
    stripX: translateX(find((style) => style.left === -DASH_PERIOD)),
  }
}

/** Sets the shared values by hand and re-renders so every style recomputes. */
const at = (
  view: ReturnType<typeof mount>,
  values: { progress: number; march: number },
) => {
  view.progress.value = values.progress
  view.march.value = values.march
  view.rerender(pictogram())
  return layers(view)
}

describe("BusyStateAnimation", () => {
  beforeEach(() => {
    mockSharedValues.length = 0
    mockReducedMotion = false
    jest.mocked(cancelAnimation).mockClear()
  })

  describe("with motion", () => {
    it("starts stacked: both chips at the row's centre and no connector", () => {
      const view = mount()

      const { icon1X, icon2X, window } = at(view, { progress: 0, march: 0 })

      expect(icon1X).toBe(CHIP_TRAVEL)
      expect(icon2X).toBe(-CHIP_TRAVEL)
      expect(window.width).toBe(0)
      expect(window.left).toBe(CHIP_SIZE + CONNECTOR_LENGTH / 2)
    })

    it("holds still for the delay, then spreads over the entrance duration", () => {
      const { progress } = mount()
      const entrance = progress.value as Recorded

      expect(entrance.delay).toBe(ENTRANCE_DELAY_MS)
      expect(entrance.animation.toValue).toBe(1)
      expect(entrance.animation.duration).toBe(ENTRANCE_DURATION_MS)
    })

    it("opens the connector about its centre as the chips part", () => {
      const view = mount()

      const half = at(view, { progress: 0.5, march: 0 })
      expect(half.icon1X).toBe(CHIP_TRAVEL / 2)
      expect(half.icon2X).toBe(-CHIP_TRAVEL / 2)
      expect(half.window.width).toBe(CONNECTOR_LENGTH / 2)
      expect(half.window.left).toBe(CHIP_SIZE + CONNECTOR_LENGTH / 4)

      const settled = at(view, { progress: 1, march: 0 })
      expect(settled.icon1X).toBeCloseTo(0)
      expect(settled.icon2X).toBeCloseTo(0)
      expect(settled.window.width).toBe(CONNECTOR_LENGTH)
      expect(settled.window.left).toBe(CHIP_SIZE)
    })

    it("marches one dash period per cycle, forever, after the same delay", () => {
      const { march } = mount()
      const marching = march.value as Recorded

      expect(marching.delay).toBe(ENTRANCE_DELAY_MS)
      expect(marching.animation.repeat).toEqual({
        toValue: DASH_PERIOD,
        duration: DASH_TRAVEL_MS,
        callback: undefined,
      })
      expect(marching.animation.count).toBe(-1)
      expect(marching.animation.reverse).toBe(false)
    })

    it("pins the dash phase to the row while the window opens", () => {
      const view = mount()

      // The window's left edge moves right by `inset`; the strip moves left by
      // the same amount, so a dash stays put on screen.
      const opening = at(view, { progress: 0.5, march: 3 })
      expect(opening.window.left as number).toBe(CHIP_SIZE + CONNECTOR_LENGTH / 4)
      expect(opening.stripX).toBe(3 - CONNECTOR_LENGTH / 4)
      expect((opening.window.left as number) + opening.stripX).toBe(CHIP_SIZE + 3)

      const settled = at(view, { progress: 1, march: 3 })
      expect(settled.stripX).toBe(3)
    })

    it("reports the entrance complete once it finishes, not when interrupted", () => {
      const onEntranceComplete = jest.fn()
      const { progress } = mount(onEntranceComplete)
      const complete = (progress.value as Recorded).animation.callback

      complete?.(false)
      expect(onEntranceComplete).not.toHaveBeenCalled()

      complete?.(true)
      expect(onEntranceComplete).toHaveBeenCalledTimes(1)
    })

    it("does not restart the entrance on a re-render", () => {
      const view = mount()
      const entrance = view.progress.value

      view.rerender(pictogram())

      expect(view.progress.value).toBe(entrance)
    })

    it("cancels both animations on unmount", () => {
      const { progress, march, unmount } = mount()

      act(() => unmount())

      expect(cancelAnimation).toHaveBeenCalledWith(progress)
      expect(cancelAnimation).toHaveBeenCalledWith(march)
    })
  })

  describe("under reduced motion", () => {
    beforeEach(() => {
      mockReducedMotion = true
    })

    it("renders the resting state with nothing scheduled", () => {
      const view = mount()

      expect(view.progress.value).toBe(1)
      expect(view.march.value).toBe(0)

      const { icon1X, icon2X, window, stripX } = layers(view)
      expect(icon1X).toBeCloseTo(0)
      expect(icon2X).toBeCloseTo(0)
      expect(window.width).toBe(CONNECTOR_LENGTH)
      expect(stripX).toBeCloseTo(0)
    })

    it("reports the entrance complete at once", () => {
      const onEntranceComplete = jest.fn()
      mount(onEntranceComplete)

      expect(onEntranceComplete).toHaveBeenCalledTimes(1)
    })
  })
})
