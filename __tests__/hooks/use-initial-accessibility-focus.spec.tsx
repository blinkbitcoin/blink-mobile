import React, { createRef, RefObject, useRef } from "react"
import { AccessibilityInfo, View } from "react-native"
import { act, render, renderHook } from "@testing-library/react-native"

import {
  INITIAL_FOCUS_DELAY_MS,
  useInitialAccessibilityFocus,
} from "@app/hooks/use-initial-accessibility-focus"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (callback: () => undefined | (() => void)) => {
    const { useEffect } = jest.requireActual("react")
    useEffect(callback, [callback])
  },
}))

jest.mock("@rn-vui/themed", () => ({
  ...jest.requireActual("@rn-vui/themed"),
  useTheme: () => ({ theme: { colors: { white: "#fff" } } }),
  makeStyles: () => () => ({}),
}))

const mockIsScreenReaderEnabled = jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled")
const mockSendAccessibilityEvent = jest
  .spyOn(AccessibilityInfo, "sendAccessibilityEvent")
  .mockImplementation(() => undefined)

/** A ref holding a stand-in for the native node the screen reader moves to. */
const nodeRef = (name: string) => ({ current: { name } as unknown as View })

/** Runs out the delay, then lets the screen reader check resolve. */
const passDelay = async () => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(INITIAL_FOCUS_DELAY_MS)
  })
}

describe("useInitialAccessibilityFocus", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockIsScreenReaderEnabled.mockResolvedValue(true)
    mockSendAccessibilityEvent.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("moves screen reader focus to the target once the screen has settled", async () => {
    const target = nodeRef("next")
    renderHook(() => useInitialAccessibilityFocus(target))

    expect(mockSendAccessibilityEvent).not.toHaveBeenCalled()
    await passDelay()

    expect(mockSendAccessibilityEvent).toHaveBeenCalledTimes(1)
    expect(mockSendAccessibilityEvent).toHaveBeenCalledWith(target.current, "focus")
  })

  it("leaves focus alone when no screen reader runs", async () => {
    mockIsScreenReaderEnabled.mockResolvedValue(false)
    renderHook(() => useInitialAccessibilityFocus(nodeRef("next")))

    await passDelay()

    expect(mockSendAccessibilityEvent).not.toHaveBeenCalled()
  })

  it("does nothing when the target isn't on screen", async () => {
    renderHook(() => useInitialAccessibilityFocus({ current: null }))

    await passDelay()

    expect(mockSendAccessibilityEvent).not.toHaveBeenCalled()
  })

  it("focuses the target the screen has when the delay ends", async () => {
    const keypad = nodeRef("keypad")
    const next = nodeRef("next")
    const { rerender } = renderHook(
      ({ target }: { target: RefObject<View | null> }) =>
        useInitialAccessibilityFocus(target),
      { initialProps: { target: keypad } },
    )

    rerender({ target: next })
    await passDelay()

    expect(mockSendAccessibilityEvent).toHaveBeenCalledTimes(1)
    expect(mockSendAccessibilityEvent).toHaveBeenCalledWith(next.current, "focus")
  })

  it("doesn't pull focus again when the target changes later", async () => {
    const { rerender } = renderHook(
      ({ target }: { target: RefObject<View | null> }) =>
        useInitialAccessibilityFocus(target),
      { initialProps: { target: nodeRef("keypad") } },
    )
    await passDelay()

    rerender({ target: nodeRef("next") })
    await passDelay()

    expect(mockSendAccessibilityEvent).toHaveBeenCalledTimes(1)
  })

  it("is cancelled when the screen goes before the delay ends", async () => {
    const { unmount } = renderHook(() => useInitialAccessibilityFocus(nodeRef("next")))

    unmount()
    await passDelay()

    expect(mockSendAccessibilityEvent).not.toHaveBeenCalled()
  })

  it("can focus a primary button through its pressableRef", async () => {
    const pressableRef = createRef<View>()
    const Screen = () => {
      const ref = useRef<View>(null)
      useInitialAccessibilityFocus(ref)
      return (
        <GaloyPrimaryButton
          title="Next"
          pressableRef={(node: View | null) => {
            ref.current = node
            ;(pressableRef as { current: View | null }).current = node
          }}
        />
      )
    }
    render(<Screen />)

    await passDelay()

    // The native view itself, not the touchable wrapper's class instance.
    expect(typeof pressableRef.current?.measure).toBe("function")
    expect(mockSendAccessibilityEvent).toHaveBeenCalledWith(pressableRef.current, "focus")
  })
})
