import { useEffect, useRef } from "react"
import { AccessibilityInfo } from "react-native"

type Options = {
  /** Waits this long after the last change, so a run of quick changes (keys typed) is
   *  spoken once, at its end. */
  delayMs?: number
  /** Stays quiet about the value the screen opens with; only changes are spoken. */
  skipInitial?: boolean
}

/**
 * Speaks `message` through the screen reader each time it changes to a new, non-empty
 * value. For text that appears or changes without moving focus — an error, a total — which
 * VoiceOver and TalkBack would otherwise never read. A no-op when no screen reader runs.
 */
export const useAccessibilityAnnouncement = (
  message: string | null | undefined,
  { delayMs = 0, skipInitial = false }: Options = {},
) => {
  const lastMessage = useRef(skipInitial ? message : undefined)

  useEffect(() => {
    const isNew = Boolean(message) && message !== lastMessage.current
    lastMessage.current = message
    if (!isNew || !message) return
    const timer = setTimeout(
      () => AccessibilityInfo.announceForAccessibility(message),
      delayMs,
    )
    return () => clearTimeout(timer)
  }, [message, delayMs])
}
