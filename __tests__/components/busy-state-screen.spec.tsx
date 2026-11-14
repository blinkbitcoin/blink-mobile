import React from "react"
import { AccessibilityInfo, BackHandler, Text as RNText } from "react-native"
import { act, fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"

import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
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

// No navigator here: focus is mount. The sibling `.stack.spec` covers blur.
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest.requireActual<typeof import("react")>("react").useEffect(callback, [callback]),
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
  type BusyStateError,
} from "@app/components/busy-state"

loadLocale("en")
const LL = i18nObject("en")

const TITLE = "Your backup phrase is used to create your Nostr keys"
const BODY = "Generating keys…"

type Overrides = {
  completion: BusyCompletion
  onDone: () => void
  body?: string
  error?: BusyStateError
}

const screenFor = (overrides: Overrides) => (
  <ThemeProvider theme={theme}>
    <TypesafeI18n locale="en">
      <BusyStateScreen
        icon1={<RNText>icon1</RNText>}
        icon2={<RNText>icon2</RNText>}
        title={TITLE}
        // An explicit `body: undefined` means "no body", not "the default".
        body={"body" in overrides ? overrides.body : BODY}
        completion={overrides.completion}
        onDone={overrides.onDone}
        error={overrides.error}
      />
    </TypesafeI18n>
  </ThemeProvider>
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

  it("renders the title and the body", () => {
    const { getByText } = render(
      screenFor({ completion: { kind: "timed" }, onDone: jest.fn() }),
    )

    expect(getByText(TITLE)).toBeTruthy()
    expect(getByText(BODY)).toBeTruthy()
  })

  it("renders the title alone when no body is given", () => {
    const { getByText, queryByTestId } = render(
      screenFor({ completion: { kind: "timed" }, onDone: jest.fn(), body: undefined }),
    )

    expect(getByText(TITLE)).toBeTruthy()
    expect(queryByTestId("busy-state-body")).toBeNull()
  })

  it("holds a timed completion for the full signal duration", () => {
    const onDone = jest.fn()
    render(screenFor({ completion: { kind: "timed" }, onDone }))

    advance(SIGNAL_MS - 1)
    expect(onDone).not.toHaveBeenCalled()

    advance(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("honours a shorter explicit hold but never goes below the floor", () => {
    const onDone = jest.fn()
    render(screenFor({ completion: { kind: "timed", durationMs: 10 }, onDone }))

    advance(MIN_VISIBLE_MS - 1)
    expect(onDone).not.toHaveBeenCalled()

    advance(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("does not flash when the work is already finished at mount", () => {
    const onDone = jest.fn()
    render(screenFor({ completion: { kind: "pending", done: true }, onDone }))

    advance(MIN_VISIBLE_MS - 1)
    expect(onDone).not.toHaveBeenCalled()

    advance(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("waits for pending work that outlasts the floor", () => {
    const onDone = jest.fn()
    const { rerender } = render(
      screenFor({ completion: { kind: "pending", done: false }, onDone }),
    )

    advance(MIN_VISIBLE_MS + 5000)
    expect(onDone).not.toHaveBeenCalled()

    act(() => {
      rerender(screenFor({ completion: { kind: "pending", done: true }, onDone }))
    })

    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("calls onDone at most once", () => {
    const onDone = jest.fn()
    const { rerender } = render(
      screenFor({ completion: { kind: "pending", done: true }, onDone }),
    )

    advance(MIN_VISIBLE_MS)
    expect(onDone).toHaveBeenCalledTimes(1)

    act(() => {
      rerender(screenFor({ completion: { kind: "pending", done: true }, onDone }))
    })
    advance(SIGNAL_MS)

    expect(onDone).toHaveBeenCalledTimes(1)
  })

  describe("error state", () => {
    const failing = (error: BusyStateError) =>
      screenFor({
        completion: { kind: "pending", done: false },
        onDone: jest.fn(),
        error,
      })

    it("replaces the busy copy with the error title and body", () => {
      const { getByText, queryByText } = render(
        failing({
          title: "Something went wrong",
          body: "No connection",
          onBack: jest.fn(),
        }),
      )

      expect(getByText("Something went wrong")).toBeTruthy()
      expect(getByText("No connection")).toBeTruthy()
      expect(queryByText(TITLE)).toBeNull()
    })

    it("shows one button per handler, in the order Try Again, Back, Close", () => {
      const { getAllByTestId, queryByTestId } = render(
        failing({ title: "Failed", onRetry: jest.fn(), onClose: jest.fn() }),
      )

      const buttons = getAllByTestId(/^busy-state-(retry|back|close)$/)
      expect(buttons.map((b) => b.props.testID)).toEqual([
        "busy-state-retry",
        "busy-state-close",
      ])
      expect(queryByTestId("busy-state-back")).toBeNull()
    })

    it("requires a way out besides Try Again", () => {
      // @ts-expect-error -- retry alone would trap the user: back is swallowed.
      const trapped: BusyStateError = { title: "Failed", onRetry: jest.fn() }
      const withBack: BusyStateError = { title: "Failed", onBack: jest.fn() }
      const withClose: BusyStateError = { title: "Failed", onClose: jest.fn() }

      expect([trapped, withBack, withClose]).toHaveLength(3)
    })

    it("announces the error title and body to screen readers", () => {
      const announce = jest
        .spyOn(AccessibilityInfo, "announceForAccessibility")
        .mockImplementation(() => undefined)

      render(failing({ title: "Failed", body: "No connection", onBack: jest.fn() }))

      expect(announce).toHaveBeenCalledWith("Failed. No connection")
      announce.mockRestore()
    })

    it("labels the buttons from the shared copy and calls their handlers", () => {
      const onRetry = jest.fn()
      const onBack = jest.fn()
      const onClose = jest.fn()
      const { getByText } = render(failing({ title: "Failed", onRetry, onBack, onClose }))

      fireEvent.press(getByText(LL.common.tryAgain()))
      fireEvent.press(getByText(LL.common.back()))
      fireEvent.press(getByText(LL.common.close()))

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onBack).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it("holds onDone back while the error shows", () => {
      const onDone = jest.fn()
      render(
        screenFor({
          completion: { kind: "pending", done: true },
          onDone,
          error: { title: "Failed", onBack: jest.fn() },
        }),
      )

      advance(SIGNAL_MS)
      expect(onDone).not.toHaveBeenCalled()
    })

    it("starts a fresh attempt, floor included, when the error clears", () => {
      const onDone = jest.fn()
      const { rerender } = render(
        screenFor({
          completion: { kind: "pending", done: false },
          onDone,
          error: { title: "Failed", onRetry: jest.fn(), onBack: jest.fn() },
        }),
      )
      advance(SIGNAL_MS)

      act(() => {
        rerender(screenFor({ completion: { kind: "pending", done: true }, onDone }))
      })

      advance(MIN_VISIBLE_MS - 1)
      expect(onDone).not.toHaveBeenCalled()

      advance(1)
      expect(onDone).toHaveBeenCalledTimes(1)
    })
  })

  describe("Android hardware back", () => {
    it("is swallowed while busy and routed to onBack on error", () => {
      const listeners: Array<() => boolean | null | undefined> = []
      jest
        .spyOn(BackHandler, "addEventListener")
        .mockImplementation((_event, handler) => {
          listeners.push(handler)
          return { remove: () => listeners.splice(listeners.indexOf(handler), 1) }
        })

      const onBack = jest.fn()
      const { rerender } = render(
        screenFor({ completion: { kind: "pending", done: false }, onDone: jest.fn() }),
      )

      expect(listeners[listeners.length - 1]()).toBe(true)
      expect(onBack).not.toHaveBeenCalled()

      act(() => {
        rerender(
          screenFor({
            completion: { kind: "pending", done: false },
            onDone: jest.fn(),
            error: { title: "Failed", onBack },
          }),
        )
      })

      expect(listeners[listeners.length - 1]()).toBe(true)
      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it("falls back to onClose on an error without onBack", () => {
      const listeners: Array<() => boolean | null | undefined> = []
      jest
        .spyOn(BackHandler, "addEventListener")
        .mockImplementation((_event, handler) => {
          listeners.push(handler)
          return { remove: () => listeners.splice(listeners.indexOf(handler), 1) }
        })

      const onClose = jest.fn()
      render(
        screenFor({
          completion: { kind: "pending", done: false },
          onDone: jest.fn(),
          error: { title: "Failed", onRetry: jest.fn(), onClose },
        }),
      )

      expect(listeners[listeners.length - 1]()).toBe(true)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})
