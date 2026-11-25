import { RefObject, useCallback, useEffect, useRef } from "react"
import { AccessibilityInfo, View } from "react-native"
import { useFocusEffect } from "@react-navigation/native"

/** Lets the screen transition settle first: TalkBack and VoiceOver land on the first
 *  element of a new screen themselves and would otherwise take the focus straight back. */
export const INITIAL_FOCUS_DELAY_MS = 500

const focusForScreenReader = async (
  target: RefObject<View | null> | undefined,
  isStillFocused: () => boolean,
) => {
  const isScreenReaderOn = await AccessibilityInfo.isScreenReaderEnabled()
  const node = target?.current
  if (isStillFocused() && isScreenReaderOn && node) {
    AccessibilityInfo.sendAccessibilityEvent(node, "focus")
  }
}

/**
 * Moves screen reader focus, each time the screen gains focus, to the element its next
 * step most likely starts from, rather than the back arrow every screen opens on.
 *
 * The first `target` the screen gives after gaining focus is the one focused, even when
 * it changes before the delay ends, so a target that moves while the sender works
 * (keypad, then Next) never pulls focus away mid-task. Pass `undefined` while the screen
 * is still loading and doesn't know its target yet; one that arrives after the delay is
 * focused as it arrives. A no-op when no screen reader runs.
 */
export const useInitialAccessibilityFocus = (
  target: RefObject<View | null> | undefined,
) => {
  const latestTargetRef = useRef(target)
  latestTargetRef.current = target
  const focusTargetRef = useRef<RefObject<View | null> | undefined>(undefined)
  if (!focusTargetRef.current) focusTargetRef.current = target
  const isAwaitingTargetRef = useRef(false)
  const isFocusedRef = useRef(false)

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true
      focusTargetRef.current = latestTargetRef.current
      const timer = setTimeout(() => {
        if (!focusTargetRef.current) {
          isAwaitingTargetRef.current = true
          return
        }
        focusForScreenReader(focusTargetRef.current, () => isFocusedRef.current)
      }, INITIAL_FOCUS_DELAY_MS)
      return () => {
        isFocusedRef.current = false
        isAwaitingTargetRef.current = false
        clearTimeout(timer)
      }
    }, []),
  )

  const hasTarget = Boolean(target)
  useEffect(() => {
    if (!hasTarget || !isAwaitingTargetRef.current) return
    isAwaitingTargetRef.current = false
    focusForScreenReader(focusTargetRef.current, () => isFocusedRef.current)
  }, [hasTarget])
}
