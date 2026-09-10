import React from "react"
import { Text as RNText } from "react-native"
import { act, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"

// Not a wholesale stub: react-native-gesture-handler reaches into reanimated's
// `createAnimatedComponent` at import time, and `Screen` imports gesture-handler,
// so the real module's `default` has to survive. Only the worklet hooks — which
// throw outside a worklets runtime — are replaced, which leaves the test
// measuring the lifecycle rather than the animation.
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual<object>("react-native-reanimated"),
  __esModule: true,
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedStyle: () => ({}),
  useReducedMotion: () => true,
  withTiming: (value: number) => value,
  withRepeat: (value: number) => value,
  cancelAnimation: jest.fn(),
}))

jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => children ?? null,
  Line: () => null,
}))

// eslint-disable-next-line import/first
import {
  BusyStateScreen,
  MIN_VISIBLE_MS,
  SIGNAL_MS,
  type BusyCompletion,
} from "@app/components/busy-state"

const renderScreen = (completion: BusyCompletion, onDone: () => void) =>
  render(
    <ThemeProvider theme={theme}>
      <BusyStateScreen
        from={{ icon: <RNText>from</RNText> }}
        to={{ icon: <RNText>to</RNText> }}
        heading="Your backup phrase is used to create your Nostr keys"
        status="Generating keys…"
        completion={completion}
        onDone={onDone}
      />
    </ThemeProvider>,
  )

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms)
  })

describe("BusyStateScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("renders the heading and the status line", () => {
    const { getByText } = renderScreen({ kind: "timed" }, jest.fn())

    expect(getByText("Your backup phrase is used to create your Nostr keys")).toBeTruthy()
    expect(getByText("Generating keys…")).toBeTruthy()
  })

  it("holds a timed completion for the full signal duration", () => {
    const onDone = jest.fn()
    renderScreen({ kind: "timed" }, onDone)

    advance(SIGNAL_MS - 1)
    expect(onDone).not.toHaveBeenCalled()

    advance(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("honours a shorter explicit hold but never goes below the floor", () => {
    const onDone = jest.fn()
    renderScreen({ kind: "timed", durationMs: 10 }, onDone)

    advance(MIN_VISIBLE_MS - 1)
    expect(onDone).not.toHaveBeenCalled()

    advance(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("does not flash when the work is already finished at mount", () => {
    const onDone = jest.fn()
    renderScreen({ kind: "pending", done: true }, onDone)

    advance(MIN_VISIBLE_MS - 1)
    expect(onDone).not.toHaveBeenCalled()

    advance(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("waits for pending work that outlasts the floor", () => {
    const onDone = jest.fn()
    const { rerender } = renderScreen({ kind: "pending", done: false }, onDone)

    advance(MIN_VISIBLE_MS + 5000)
    expect(onDone).not.toHaveBeenCalled()

    act(() => {
      rerender(
        <ThemeProvider theme={theme}>
          <BusyStateScreen
            from={{ icon: <RNText>from</RNText> }}
            to={{ icon: <RNText>to</RNText> }}
            heading="Your backup phrase is used to create your Nostr keys"
            status="Generating keys…"
            completion={{ kind: "pending", done: true }}
            onDone={onDone}
          />
        </ThemeProvider>,
      )
    })

    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("calls onDone at most once", () => {
    const onDone = jest.fn()
    const { rerender } = renderScreen({ kind: "pending", done: true }, onDone)

    advance(MIN_VISIBLE_MS)
    expect(onDone).toHaveBeenCalledTimes(1)

    act(() => {
      rerender(
        <ThemeProvider theme={theme}>
          <BusyStateScreen
            from={{ icon: <RNText>from</RNText> }}
            to={{ icon: <RNText>to</RNText> }}
            heading="Your backup phrase is used to create your Nostr keys"
            status="Generating keys…"
            completion={{ kind: "pending", done: true }}
            onDone={onDone}
          />
        </ThemeProvider>,
      )
    })
    advance(SIGNAL_MS)

    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
