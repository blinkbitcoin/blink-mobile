import React from "react"
import {
  AccessibilityInfo,
  AppState,
  AppStateStatus,
  BackHandler,
  View,
} from "react-native"
import Animated, { getAnimatedStyle } from "react-native-reanimated"
import { act, render, renderHook, screen } from "@testing-library/react-native"

import {
  SENT_HOLD_MS,
  SENT_TIMELINE_MS,
  useSentTransition,
} from "@app/screens/send-bitcoin-screen/review/use-sent-transition"
import { sentHeroGrowth } from "@app/screens/send-bitcoin-screen/send-hero"

type Listener = () => void

const mockNavigation = {
  setOptions: jest.fn(),
  isFocused: jest.fn(() => true),
  listeners: {} as Record<string, Listener[]>,
  addListener: jest.fn((event: string, listener: Listener) => {
    mockNavigation.listeners[event] = mockNavigation.listeners[event] ?? []
    const listeners = mockNavigation.listeners[event]
    listeners.push(listener)
    return () => listeners.splice(listeners.indexOf(listener), 1)
  }),
}

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => mockNavigation,
}))

const AMOUNTS = { primaryAmount: "$10.00", hasSecondaryAmount: true }

let appStateListeners: Array<(state: AppStateStatus) => void> = []

const setAppState = (state: AppStateStatus) => {
  Object.defineProperty(AppState, "currentState", { value: state, configurable: true })
  act(() => appStateListeners.forEach((listener) => listener(state)))
}

const emitNavigation = (event: "focus" | "blur") =>
  act(() => (mockNavigation.listeners[event] ?? []).forEach((listener) => listener()))

const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms))

const progressOf = (transition: ReturnType<typeof useSentTransition>) => ({
  hero: transition.heroProgress.value,
  glow: transition.glowProgress.value,
})

describe("useSentTransition", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    /** React Native's mock is a bare jest.fn, which restoreAllMocks leaves as the last case
     *  set it: one case's screen reader would otherwise stay on for every case after it. */
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(false)
    mockNavigation.listeners = {}
    mockNavigation.isFocused.mockReturnValue(true)
    appStateListeners = []
    jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
      appStateListeners.push(listener)
      return {
        remove: () => {
          appStateListeners = appStateListeners.filter((other) => other !== listener)
        },
      }
    })
    Object.defineProperty(AppState, "currentState", {
      value: "active",
      configurable: true,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  const renderTransition = () => renderHook(() => useSentTransition())

  const playSent = async (result: { current: ReturnType<typeof useSentTransition> }) => {
    await act(async () => {
      await result.current.playSent(AMOUNTS)
    })
  }

  it("plays Sent through to the end while the app is in front", async () => {
    const { result } = renderTransition()

    await playSent(result)
    expect(result.current.isSent).toBe(true)
    expect(result.current.sentPlay).toBeGreaterThan(0)

    advance(SENT_TIMELINE_MS)
    expect(progressOf(result.current)).toEqual({ hero: 1, glow: 1 })
  })

  it("rewinds a play the app leaves mid-way, and replays it in full on return", async () => {
    const { result } = renderTransition()

    await playSent(result)
    const firstPlay = result.current.sentPlay
    advance(SENT_TIMELINE_MS / 4)

    setAppState("background")
    expect(result.current.isSent).toBe(true)
    expect(result.current.sentPlay).toBe(0)
    expect(progressOf(result.current)).toEqual({ hero: 0, glow: 0 })

    advance(SENT_TIMELINE_MS * 4)
    expect(progressOf(result.current)).toEqual({ hero: 0, glow: 0 })

    setAppState("active")
    await act(async () => {})
    expect(result.current.sentPlay).toBeGreaterThan(firstPlay)
    expect(result.current.heroProgress.value).toBeLessThan(1)

    advance(SENT_TIMELINE_MS)
    expect(progressOf(result.current)).toEqual({ hero: 1, glow: 1 })
  })

  it("leaves a settled Sent as it is when the app leaves", async () => {
    const { result } = renderTransition()

    await playSent(result)
    advance(SENT_TIMELINE_MS)
    const settledPlay = result.current.sentPlay

    setAppState("background")
    setAppState("active")
    await act(async () => {})

    expect(result.current.sentPlay).toBe(settledPlay)
    expect(progressOf(result.current)).toEqual({ hero: 1, glow: 1 })
  })

  it("holds a payment that lands while the app is away, and plays it on return", async () => {
    Object.defineProperty(AppState, "currentState", {
      value: "background",
      configurable: true,
    })
    const { result } = renderTransition()

    await playSent(result)
    expect(result.current.isSent).toBe(true)
    expect(result.current.sentPlay).toBe(0)
    advance(SENT_TIMELINE_MS)
    expect(progressOf(result.current)).toEqual({ hero: 0, glow: 0 })

    setAppState("active")
    await act(async () => {})
    expect(result.current.sentPlay).toBeGreaterThan(0)

    advance(SENT_TIMELINE_MS)
    expect(progressOf(result.current)).toEqual({ hero: 1, glow: 1 })
  })

  it("waits out the lock screen, then replays once review is back in front", async () => {
    const { result } = renderTransition()

    await playSent(result)
    advance(SENT_TIMELINE_MS / 4)

    setAppState("background")
    mockNavigation.isFocused.mockReturnValue(false)
    setAppState("active")
    emitNavigation("blur")
    await act(async () => {})
    expect(result.current.sentPlay).toBe(0)

    mockNavigation.isFocused.mockReturnValue(true)
    emitNavigation("focus")
    await act(async () => {})
    expect(result.current.sentPlay).toBeGreaterThan(0)

    advance(SENT_TIMELINE_MS)
    expect(progressOf(result.current)).toEqual({ hero: 1, glow: 1 })
  })

  it("rewinds a play the lock screen covers mid-way", async () => {
    const { result } = renderTransition()

    await playSent(result)
    advance(SENT_TIMELINE_MS / 4)

    mockNavigation.isFocused.mockReturnValue(false)
    emitNavigation("blur")
    expect(result.current.sentPlay).toBe(0)
    expect(progressOf(result.current)).toEqual({ hero: 0, glow: 0 })
  })

  describe("hand-over to the receipt", () => {
    const renderWithHold = () => {
      const onHoldEnd = jest.fn()
      const rendered = renderHook(() => useSentTransition({ onHoldEnd }))
      return { ...rendered, onHoldEnd }
    }

    it("opens the receipt once a settled Sent has held for the hold time", async () => {
      const { result, onHoldEnd } = renderWithHold()

      await playSent(result)
      advance(SENT_TIMELINE_MS + SENT_HOLD_MS - 1)
      expect(onHoldEnd).not.toHaveBeenCalled()

      advance(1)
      expect(onHoldEnd).toHaveBeenCalledTimes(1)
    })

    it("stops the hold while the app is away, and starts it over on return", async () => {
      const { result, onHoldEnd } = renderWithHold()

      await playSent(result)
      advance(SENT_TIMELINE_MS + SENT_HOLD_MS / 2)

      setAppState("background")
      advance(SENT_HOLD_MS * 4)
      expect(onHoldEnd).not.toHaveBeenCalled()

      setAppState("active")
      advance(SENT_HOLD_MS - 1)
      expect(onHoldEnd).not.toHaveBeenCalled()

      advance(1)
      expect(onHoldEnd).toHaveBeenCalledTimes(1)
    })

    it("stops the hold under the lock screen", async () => {
      const { result, onHoldEnd } = renderWithHold()

      await playSent(result)
      advance(SENT_TIMELINE_MS)

      mockNavigation.isFocused.mockReturnValue(false)
      emitNavigation("blur")
      advance(SENT_HOLD_MS * 2)
      expect(onHoldEnd).not.toHaveBeenCalled()

      mockNavigation.isFocused.mockReturnValue(true)
      emitNavigation("focus")
      advance(SENT_HOLD_MS)
      expect(onHoldEnd).toHaveBeenCalledTimes(1)
    })

    /** A timer would move the screen away while a screen-reader user finds Receipt and
     *  Close, so Sent holds until they tap. */
    it("holds for good while a screen reader is on", async () => {
      jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true)
      const { result, onHoldEnd } = renderWithHold()
      await act(async () => {})

      await playSent(result)
      advance(SENT_TIMELINE_MS + SENT_HOLD_MS * 10)

      expect(onHoldEnd).not.toHaveBeenCalled()
    })

    it("stops the hold when a screen reader is turned on during it", async () => {
      let onScreenReaderChanged: (isOn: boolean) => void = () => {}
      jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((
        event: string,
        listener: (isOn: boolean) => void,
      ) => {
        if (event === "screenReaderChanged") onScreenReaderChanged = listener
        return { remove: jest.fn() }
      }) as unknown as typeof AccessibilityInfo.addEventListener)
      const { result, onHoldEnd } = renderWithHold()

      await playSent(result)
      advance(SENT_TIMELINE_MS + SENT_HOLD_MS / 2)
      act(() => onScreenReaderChanged(true))
      advance(SENT_HOLD_MS * 10)

      expect(onHoldEnd).not.toHaveBeenCalled()
    })
  })
  describe("while Sent holds", () => {
    const backPressHandlers = () =>
      jest
        .mocked(BackHandler.addEventListener)
        .mock.calls.filter(([event]) => event === "hardwareBackPress")
        .map(([, handler]) => handler)

    beforeEach(() => {
      jest.spyOn(BackHandler, "addEventListener")
    })

    /** A back the sender takes, as navigation hands it to `beforeRemove`. */
    const tryToLeave = (type: string) => {
      const event = { data: { action: { type } }, preventDefault: jest.fn() }
      act(() =>
        (mockNavigation.listeners.beforeRemove ?? []).forEach((listener) =>
          (listener as unknown as (e: typeof event) => void)(event),
        ),
      )
      return event.preventDefault
    }

    it("leaves back alone on review", () => {
      renderTransition()

      expect(backPressHandlers().map((handler) => handler())).toEqual([false])
      expect(tryToLeave("GO_BACK")).not.toHaveBeenCalled()
      expect(mockNavigation.setOptions).not.toHaveBeenCalled()
    })

    /** Sent measures the screen before it draws, and a native measurement can be slow.
     *  The payment has landed by then, so back is shut the moment success is accepted. */
    it("shuts back the moment the payment is accepted, while Sent is still measuring", () => {
      const { result } = renderTransition()
      /** A view whose measurement never answers, so Sent stays measuring. */
      const unanswered = { measureInWindow: jest.fn() } as unknown as View
      ;(result.current.stageRef as { current: View | null }).current = unanswered

      act(() => {
        result.current.playSent(AMOUNTS)
      })

      expect(result.current.isSent).toBe(false)
      expect(backPressHandlers().map((handler) => handler())).toEqual([true])
      expect(tryToLeave("GO_BACK")).toHaveBeenCalledTimes(1)
      expect(tryToLeave("POP")).toHaveBeenCalledTimes(1)
      expect(mockNavigation.setOptions).toHaveBeenCalledWith({ gestureEnabled: false })
    })

    /** Receipt resets the stack and Close pops to Home: neither is a back. */
    it("lets Receipt and Close leave while Sent holds", async () => {
      const { result } = renderTransition()

      await playSent(result)

      expect(tryToLeave("RESET")).not.toHaveBeenCalled()
      expect(tryToLeave("POP_TO_TOP")).not.toHaveBeenCalled()
    })

    /** The actions are the way out: back would land on a review that already paid. */
    it("blocks the swipe back and swallows the hardware back", async () => {
      const { result } = renderTransition()

      await playSent(result)

      expect(mockNavigation.setOptions).toHaveBeenCalledWith({ gestureEnabled: false })
      const handlers = backPressHandlers()
      expect(handlers).toHaveLength(1)
      expect(handlers[0]()).toBe(true)
      expect(tryToLeave("GO_BACK")).toHaveBeenCalledTimes(1)
    })

    it("lets the hardware back go once review is gone", async () => {
      const remove = jest.fn()
      jest.mocked(BackHandler.addEventListener).mockReturnValue({ remove })
      const { result, unmount } = renderTransition()

      await playSent(result)
      unmount()

      expect(remove).toHaveBeenCalledTimes(1)
    })

    it("does not open the receipt after review is gone", async () => {
      const onHoldEnd = jest.fn()
      const { result, unmount } = renderHook(() => useSentTransition({ onHoldEnd }))

      await playSent(result)
      unmount()
      advance(SENT_TIMELINE_MS + SENT_HOLD_MS * 2)

      expect(onHoldEnd).not.toHaveBeenCalled()
    })
  })

  /** iOS sits in inactive under Control Centre, Siri, the app switcher and the start of a
   *  lock: review is covered there as much as in the background. */
  describe("while iOS covers review", () => {
    it("rewinds a play that inactive interrupts, and replays it in full on return", async () => {
      const { result } = renderTransition()

      await playSent(result)
      advance(SENT_TIMELINE_MS / 4)
      setAppState("inactive")

      expect(result.current.sentPlay).toBe(0)
      expect(progressOf(result.current)).toEqual({ hero: 0, glow: 0 })

      setAppState("active")
      await act(async () => {})
      advance(SENT_TIMELINE_MS)
      expect(progressOf(result.current)).toEqual({ hero: 1, glow: 1 })
    })

    it("stops the hold while inactive, and starts it over on return", async () => {
      const onHoldEnd = jest.fn()
      const { result } = renderHook(() => useSentTransition({ onHoldEnd }))

      await playSent(result)
      advance(SENT_TIMELINE_MS + SENT_HOLD_MS / 2)
      setAppState("inactive")
      advance(SENT_HOLD_MS * 4)
      expect(onHoldEnd).not.toHaveBeenCalled()

      setAppState("active")
      advance(SENT_HOLD_MS - 1)
      expect(onHoldEnd).not.toHaveBeenCalled()
      advance(1)
      expect(onHoldEnd).toHaveBeenCalledTimes(1)
    })
  })

  describe("Receipt and Close", () => {
    const ACTIONS_DELAY_MS = 500

    it("stay out of reach on review", () => {
      const { result } = renderTransition()

      expect(result.current.areActionsLive).toBe(false)
    })

    it("go live as they start to fade in, not while invisible", async () => {
      const { result } = renderTransition()

      await playSent(result)
      advance(ACTIONS_DELAY_MS - 1)
      expect(result.current.areActionsLive).toBe(false)

      advance(1)
      expect(result.current.areActionsLive).toBe(true)
    })

    it("go out of reach again when a play is rewound", async () => {
      const { result } = renderTransition()

      await playSent(result)
      advance(ACTIONS_DELAY_MS / 2)
      setAppState("background")
      advance(ACTIONS_DELAY_MS * 4)

      expect(result.current.areActionsLive).toBe(false)
    })

    it("stay out of reach while a payment that landed away waits to replay", async () => {
      Object.defineProperty(AppState, "currentState", {
        value: "background",
        configurable: true,
      })
      const { result } = renderTransition()

      await playSent(result)
      advance(ACTIONS_DELAY_MS * 4)

      expect(result.current.isSent).toBe(true)
      expect(result.current.areActionsLive).toBe(false)
    })
  })

  /** Each platform hides from its own screen reader by its own prop, so both are read. */
  describe("what dissolves into Sent", () => {
    it("stays in the accessibility tree on review", () => {
      const { result } = renderTransition()

      expect(result.current.goneWhenSent.accessibilityElementsHidden).toBe(false)
      expect(result.current.goneWhenSent.importantForAccessibility).toBe("auto")
    })

    it("leaves the accessibility tree on both platforms once Sent plays", async () => {
      const { result } = renderTransition()

      await playSent(result)

      expect(result.current.goneWhenSent.accessibilityElementsHidden).toBe(true)
      expect(result.current.goneWhenSent.importantForAccessibility).toBe(
        "no-hide-descendants",
      )
    })

    it("leaves it as soon as the payment lands, even while Sent waits to replay", async () => {
      Object.defineProperty(AppState, "currentState", {
        value: "background",
        configurable: true,
      })
      const { result } = renderTransition()

      await playSent(result)

      expect(result.current.sentPlay).toBe(0)
      expect(result.current.goneWhenSent.accessibilityElementsHidden).toBe(true)
      expect(result.current.goneWhenSent.importantForAccessibility).toBe(
        "no-hide-descendants",
      )
    })
  })

  describe("centring the hero", () => {
    const STAGE = { x: 0, y: 0, width: 360, height: 800 }
    const HERO = { x: 0, y: 120, width: 360, height: 110 }

    /** The hook's refs on real views, so the hero's travel can be read off its style. */
    const renderStage = () => {
      const transition: { current?: ReturnType<typeof useSentTransition> } = {}
      const Stage = () => {
        const sent = useSentTransition()
        transition.current = sent
        return React.createElement(
          View,
          { ref: sent.stageRef, testID: "stage" },
          React.createElement(Animated.View, {
            ref: sent.heroRef,
            testID: "hero",
            style: sent.heroStyle,
          }),
        )
      }
      render(React.createElement(Stage))
      return transition as { current: ReturnType<typeof useSentTransition> }
    }

    /** Each native view answers with its own frame, read off its test ID. */
    const answerMeasurements = () =>
      screen.UNSAFE_root.findAll((node) =>
        jest.isMockFunction(node.instance?.measureInWindow),
      ).forEach((node) => {
        const frame = node.props.testID === "stage" ? STAGE : HERO
        node.instance.measureInWindow = jest.fn(
          (callback: (x: number, y: number, width: number, height: number) => void) =>
            callback(frame.x, frame.y, frame.width, frame.height),
        )
      })

    it("blooms the glow from the middle of the screen, out to the screen's height", async () => {
      const transition = renderStage()
      answerMeasurements()

      await playSent(transition)

      expect(transition.current.glowFrame).toEqual({
        centerX: STAGE.width / 2,
        centerY: STAGE.height / 2,
        radius: STAGE.height,
      })
    })

    it("lands the grown hero on the middle of the screen", async () => {
      const transition = renderStage()
      answerMeasurements()

      await playSent(transition)
      advance(SENT_TIMELINE_MS)

      const grownHeight = HERO.height + sentHeroGrowth(AMOUNTS)
      const travel = STAGE.height / 2 - (HERO.y - STAGE.y + grownHeight / 2)
      expect(getAnimatedStyle(screen.getByTestId("hero"))).toMatchObject({
        transform: [{ translateY: travel }],
      })
    })

    it("still plays Sent where the screen cannot be measured, with no glow", async () => {
      const { result } = renderTransition()

      await playSent(result)
      advance(SENT_TIMELINE_MS)

      expect(result.current.glowFrame).toBeUndefined()
      expect(progressOf(result.current)).toEqual({ hero: 1, glow: 1 })
    })
  })
})
