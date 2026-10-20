import { AppState, AppStateStatus } from "react-native"
import { act, renderHook } from "@testing-library/react-native"

import {
  SENT_TIMELINE_MS,
  useSentTransition,
} from "@app/screens/send-bitcoin-screen/review/use-sent-transition"

type Listener = () => void

const mockNavigation = {
  setOptions: jest.fn(),
  isFocused: jest.fn(() => true),
  listeners: {} as Record<string, Listener[]>,
  addListener: jest.fn((event: string, listener: Listener) => {
    const listeners = (mockNavigation.listeners[event] ??= [])
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
})
